'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createDeliverySchema, type CreateDeliveryInput } from '@/lib/validators/delivery'
import type { DeliveryStatus, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface DeliveryPaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  vehicleId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DeliveryKPIs {
  loading: number
  inTransit: number
  delivered: number
  total: number
}

export interface DeliveryCheckItem {
  orderItemId: string
  productId: string
  productName: string
  quantityOrdered: number
  unit: string
  piecesPerM2: number | null
  quantityPieces: number
  alreadyDelivered: number
  remaining: number
  availableStock: number
}

// ===== Listagem paginada =====

export async function getDeliveriesPaginated(params: DeliveryPaginationParams) {
  const { page, pageSize, search, status, vehicleId, driverId, dateFrom, dateTo, sortBy, sortOrder } = params

  const where: Prisma.DeliveryWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as DeliveryStatus
  }

  if (vehicleId) {
    where.vehicleId = vehicleId
  }

  if (driverId) {
    where.driverId = driverId
  }

  if (dateFrom || dateTo) {
    where.loadingDate = {}
    if (dateFrom) (where.loadingDate as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.loadingDate as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { order: { customer: { companyName: { contains: search } } } },
      { order: { customer: { tradeName: { contains: search } } } },
      ...(searchNum ? [{ number: searchNum }] : []),
    ]
  }

  let orderBy: Prisma.DeliveryOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderBy = { number: sortOrder || 'desc' }
        break
      case 'loadingDate':
        orderBy = { loadingDate: sortOrder || 'desc' }
        break
      case 'deliveryDate':
        orderBy = { deliveryDate: sortOrder || 'desc' }
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            number: true,
            customer: { select: { companyName: true, tradeName: true } },
          },
        },
        vehicle: { select: { plate: true, description: true } },
        driver: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.delivery.count({ where }),
  ])

  return {
    data: data.map((d) => ({
      ...d,
      loadingDate: d.loadingDate.toISOString(),
      deliveryDate: d.deliveryDate?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== KPIs =====

export async function getDeliveryKPIs(): Promise<DeliveryKPIs> {
  const [loading, inTransit, delivered, total] = await Promise.all([
    prisma.delivery.count({ where: { status: 'LOADING' } }),
    prisma.delivery.count({ where: { status: 'IN_TRANSIT' } }),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.delivery.count(),
  ])

  return { loading, inTransit, delivered, total }
}

// ===== Pedidos com status READY para dropdown =====

export async function getReadyOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['READY', 'IN_PRODUCTION'] } },
    select: {
      id: true,
      number: true,
      customer: { select: { companyName: true, tradeName: true } },
    },
    orderBy: { number: 'asc' },
  })

  return orders
}

// ===== Verificação de itens para entrega =====

export async function getDeliveryCheckForOrder(orderId: string): Promise<DeliveryCheckItem[]> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              costRecipe: { select: { piecesPerM2: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Somar já entregue por orderItemId (excluindo canceladas)
  const deliveredItems = await prisma.deliveryItem.groupBy({
    by: ['orderItemId'],
    where: {
      delivery: {
        orderId,
        status: { not: 'CANCELLED' },
      },
    },
    _sum: { quantityPieces: true },
  })

  const deliveredMap = new Map(
    deliveredItems.map((di) => [di.orderItemId, di._sum.quantityPieces || 0])
  )

  // Calcular estoque disponível por produto
  const productIds = [...new Set(order.items.map((i) => i.productId))]
  const stockMap = new Map<string, number>()

  for (const productId of productIds) {
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId },
      select: { type: true, quantityPieces: true },
    })
    let totalIn = 0
    let totalOut = 0
    for (const mov of movements) {
      if (mov.type === 'IN') totalIn += mov.quantityPieces
      else totalOut += mov.quantityPieces
    }
    stockMap.set(productId, totalIn - totalOut)
  }

  return order.items.map((item) => {
    const piecesPerM2 = item.product.costRecipe?.piecesPerM2 || null
    const quantityPieces = item.unit === 'M2' && piecesPerM2
      ? Math.ceil(item.quantity * piecesPerM2)
      : Math.ceil(item.quantity)

    const alreadyDelivered = deliveredMap.get(item.id) || 0
    const remaining = Math.max(0, quantityPieces - alreadyDelivered)

    return {
      orderItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantityOrdered: item.quantity,
      unit: item.unit,
      piecesPerM2,
      quantityPieces,
      alreadyDelivered,
      remaining,
      availableStock: stockMap.get(item.productId) || 0,
    }
  })
}

// ===== Endereço de entrega =====

export async function getDeliveryAddress(orderId: string): Promise<string> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      quote: { select: { deliveryAddress: true } },
      customer: {
        select: {
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          zipCode: true,
        },
      },
    },
  })

  // Prioridade: endereço do orçamento > endereço do cliente formatado
  if (order.quote?.deliveryAddress) {
    return order.quote.deliveryAddress
  }

  const c = order.customer
  const parts = [
    c.street,
    c.number,
    c.complement,
    c.neighborhood,
    c.city && c.state ? `${c.city}/${c.state}` : c.city || c.state,
    c.zipCode,
  ].filter(Boolean)

  return parts.join(', ')
}

// ===== Criar entrega =====

export async function createDelivery(data: CreateDeliveryInput) {
  const parsed = createDeliverySchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { orderId, vehicleId, driverId, loadingDate, deliveryAddress, notes, items } = parsed.data

  // Verificar se o pedido está em status válido (READY ou IN_PRODUCTION)
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  if (!['READY', 'IN_PRODUCTION'].includes(order.status)) {
    throw new Error('Pedido precisa estar com status Pronto ou Em Produção para criar entrega')
  }

  // Verificar estoque disponível e quantidades
  const check = await getDeliveryCheckForOrder(orderId)
  for (const item of items) {
    const checkItem = check.find((c) => c.orderItemId === item.orderItemId)
    if (!checkItem) {
      throw new Error('Item do pedido não encontrado')
    }
    if (item.quantityPieces > checkItem.remaining) {
      throw new Error(`${checkItem.productName}: quantidade (${item.quantityPieces}) excede o restante (${checkItem.remaining})`)
    }
    if (item.quantityPieces > checkItem.availableStock) {
      throw new Error(`${checkItem.productName}: estoque insuficiente (disponível: ${checkItem.availableStock}, solicitado: ${item.quantityPieces})`)
    }
  }

  const delivery = await prisma.$transaction(async (tx) => {
    // Próximo número sequencial
    const last = await tx.delivery.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    // Criar entrega
    const del = await tx.delivery.create({
      data: {
        number: nextNumber,
        orderId,
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        loadingDate: new Date(loadingDate),
        deliveryAddress: deliveryAddress || null,
        notes: notes || null,
        status: 'LOADING',
        items: {
          create: items.map((item) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            quantityPieces: item.quantityPieces,
          })),
        },
      },
    })

    // Criar InventoryMovement OUT para cada item
    for (const item of items) {
      const recipe = await tx.costRecipe.findUnique({
        where: { productId: item.productId },
        select: { piecesPerPallet: true, piecesPerM2: true },
      })

      const quantityPallets = recipe?.piecesPerPallet
        ? item.quantityPieces / recipe.piecesPerPallet
        : null
      const areaM2 = recipe?.piecesPerM2
        ? item.quantityPieces / recipe.piecesPerM2
        : null

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          date: new Date(loadingDate),
          type: 'OUT',
          quantityPieces: item.quantityPieces,
          quantityPallets,
          areaM2,
          deliveryId: del.id,
          notes: `Entrega ENT-${String(nextNumber).padStart(4, '0')}`,
        },
      })
    }

    return del
  })

  revalidatePath('/logistica/entregas')
  revalidatePath('/estoque')
  revalidatePath('/comercial/pedidos')
  return delivery
}

// ===== Atualizar status da entrega =====

const VALID_DELIVERY_TRANSITIONS: Record<string, string[]> = {
  LOADING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
}

export async function updateDeliveryStatus(id: string, newStatus: DeliveryStatus) {
  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  })

  const allowed = VALID_DELIVERY_TRANSITIONS[delivery.status]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Transição de ${delivery.status} para ${newStatus} não é permitida`)
  }

  await prisma.$transaction(async (tx) => {
    const updateData: Prisma.DeliveryUpdateInput = { status: newStatus }

    if (newStatus === 'DELIVERED') {
      updateData.deliveryDate = new Date()
    }

    if (newStatus === 'CANCELLED') {
      // Reverter estoque: criar InventoryMovement IN para cada item
      for (const item of delivery.items) {
        const recipe = await tx.costRecipe.findUnique({
          where: { productId: item.productId },
          select: { piecesPerPallet: true, piecesPerM2: true },
        })

        const quantityPallets = recipe?.piecesPerPallet
          ? item.quantityPieces / recipe.piecesPerPallet
          : null
        const areaM2 = recipe?.piecesPerM2
          ? item.quantityPieces / recipe.piecesPerM2
          : null

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            date: new Date(),
            type: 'IN',
            quantityPieces: item.quantityPieces,
            quantityPallets,
            areaM2,
            deliveryId: delivery.id,
            notes: `Cancelamento entrega ENT-${String(delivery.number).padStart(4, '0')}`,
          },
        })
      }
    }

    await tx.delivery.update({
      where: { id },
      data: updateData,
    })

    // Verificar e atualizar status do pedido
    await checkAndUpdateOrderDeliveryStatus(delivery.orderId, tx)
  })

  revalidatePath('/logistica/entregas')
  revalidatePath('/estoque')
  revalidatePath('/comercial/pedidos')
}

// ===== Excluir entrega =====

export async function deleteDelivery(id: string) {
  const delivery = await prisma.delivery.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  })

  if (delivery.status !== 'LOADING') {
    throw new Error('Apenas entregas em carregamento podem ser excluídas')
  }

  await prisma.$transaction(async (tx) => {
    // Reverter estoque: criar InventoryMovement IN para cada item
    for (const item of delivery.items) {
      const recipe = await tx.costRecipe.findUnique({
        where: { productId: item.productId },
        select: { piecesPerPallet: true, piecesPerM2: true },
      })

      const quantityPallets = recipe?.piecesPerPallet
        ? item.quantityPieces / recipe.piecesPerPallet
        : null
      const areaM2 = recipe?.piecesPerM2
        ? item.quantityPieces / recipe.piecesPerM2
        : null

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          date: new Date(),
          type: 'IN',
          quantityPieces: item.quantityPieces,
          quantityPallets,
          areaM2,
          deliveryId: delivery.id,
          notes: `Exclusão entrega ENT-${String(delivery.number).padStart(4, '0')}`,
        },
      })
    }

    // Excluir entrega (cascade exclui DeliveryItems)
    await tx.delivery.delete({ where: { id } })

    // Verificar e atualizar status do pedido
    await checkAndUpdateOrderDeliveryStatus(delivery.orderId, tx)
  })

  revalidatePath('/logistica/entregas')
  revalidatePath('/estoque')
  revalidatePath('/comercial/pedidos')
}

// ===== Função interna: verificar e atualizar status do pedido =====

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function checkAndUpdateOrderDeliveryStatus(orderId: string, tx: TransactionClient) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              costRecipe: { select: { piecesPerM2: true } },
            },
          },
        },
      },
    },
  })

  // Para cada item do pedido, verificar se está 100% entregue
  let allDelivered = true

  for (const item of order.items) {
    const piecesPerM2 = item.product.costRecipe?.piecesPerM2 || null
    const quantityPieces = item.unit === 'M2' && piecesPerM2
      ? Math.ceil(item.quantity * piecesPerM2)
      : Math.ceil(item.quantity)

    const deliveredSum = await tx.deliveryItem.aggregate({
      where: {
        orderItemId: item.id,
        delivery: { status: { not: 'CANCELLED' } },
      },
      _sum: { quantityPieces: true },
    })

    const delivered = deliveredSum._sum.quantityPieces || 0
    if (delivered < quantityPieces) {
      allDelivered = false
      break
    }
  }

  if (allDelivered && order.status !== 'DELIVERED') {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
    })
  } else if (!allDelivered && order.status === 'DELIVERED') {
    // Se cancelamento reverteu, voltar para READY
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'READY' },
    })
  }
}
