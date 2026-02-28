'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { generateProductionOrdersSchema, type GenerateProductionOrdersInput } from '@/lib/validators/production-order'
import type { Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface ProductionOrderPaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  orderId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ProductionOrderKPIs {
  total: number
  pending: number
  inProgress: number
  completed: number
  pendingPieces: number
}

export interface StockCheckItem {
  orderItemId: string
  productId: string
  productName: string
  quantityOrdered: number
  unit: string
  piecesPerM2: number | null
  quantityPieces: number
  availableStock: number
  reservedByOthers: number
  reservedDetails: { opNumber: number; orderNumber: number; pieces: number }[]
  suggestedToProduce: number
}

// ===== Utilitário: Estoque disponível por produto =====

export async function getAvailableStockForProduct(productId: string): Promise<number> {
  const movements = await prisma.inventoryMovement.findMany({
    where: { productId },
    select: { type: true, quantityPieces: true },
  })

  let totalIn = 0
  let totalOut = 0
  for (const mov of movements) {
    if (mov.type === 'IN') {
      totalIn += mov.quantityPieces
    } else {
      totalOut += mov.quantityPieces
    }
  }

  return totalIn - totalOut
}

// ===== Verificação de estoque para geração de OPs =====

export async function getStockCheckForOrder(orderId: string): Promise<StockCheckItem[]> {
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

  // Buscar todas as OPs ativas (PENDING/IN_PROGRESS) agrupadas por produto
  const activeOPs = await prisma.productionOrder.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      orderId: { not: orderId }, // Excluir OPs do próprio pedido
    },
    select: {
      number: true,
      productId: true,
      quantityPieces: true,
      order: { select: { number: true } },
    },
  })

  const reservedMap = new Map<string, { total: number; details: { opNumber: number; orderNumber: number; pieces: number }[] }>()
  for (const op of activeOPs) {
    const existing = reservedMap.get(op.productId) || { total: 0, details: [] }
    existing.total += op.quantityPieces
    existing.details.push({ opNumber: op.number, orderNumber: op.order.number, pieces: op.quantityPieces })
    reservedMap.set(op.productId, existing)
  }

  const result: StockCheckItem[] = []

  for (const item of order.items) {
    const piecesPerM2 = item.product.costRecipe?.piecesPerM2 ?? null

    // Converter para peças
    let quantityPieces: number
    if (item.unit === 'M2' && piecesPerM2) {
      quantityPieces = Math.ceil(item.quantity * piecesPerM2)
    } else {
      quantityPieces = Math.ceil(item.quantity)
    }

    const availableStock = await getAvailableStockForProduct(item.productId)
    const reserved = reservedMap.get(item.productId) || { total: 0, details: [] }
    const effectiveStock = Math.max(0, availableStock - reserved.total)
    const suggestedToProduce = Math.max(0, quantityPieces - effectiveStock)

    result.push({
      orderItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantityOrdered: item.quantity,
      unit: item.unit,
      piecesPerM2,
      quantityPieces,
      availableStock,
      reservedByOthers: reserved.total,
      reservedDetails: reserved.details,
      suggestedToProduce,
    })
  }

  return result
}

// ===== Gerar Ordens de Produção =====

export async function generateProductionOrders(input: GenerateProductionOrdersInput) {
  const parsed = generateProductionOrdersSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { orderId, items } = parsed.data

  // Verificar que o pedido está CONFIRMED e não tem OPs existentes
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  if (order.status !== 'CONFIRMED') {
    throw new Error('Apenas pedidos confirmados podem gerar ordens de produção')
  }

  const existingOPs = await prisma.productionOrder.count({ where: { orderId } })
  if (existingOPs > 0) {
    throw new Error('Este pedido já possui ordens de produção')
  }

  await prisma.$transaction(async (tx) => {
    // Buscar último número sequencial
    const last = await tx.productionOrder.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    let nextNumber = (last?.number ?? 0) + 1

    for (const item of items) {
      const stock = await getAvailableStockForProduct(item.productId)

      await tx.productionOrder.create({
        data: {
          number: nextNumber++,
          orderId,
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantityPieces: item.quantityPieces,
          stockAtCreation: Math.max(0, stock),
          toProducePieces: item.toProducePieces,
          status: 'PENDING',
          notes: item.notes || null,
        },
      })
    }

    // Mudar status do pedido para IN_PRODUCTION
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'IN_PRODUCTION' },
    })
  })

  revalidatePath('/producao/ordens')
  revalidatePath('/comercial/pedidos')
}

// ===== Avaliação lazy: verificar e atualizar status das OPs =====

export async function checkAndUpdateProductionOrderStatuses() {
  // Buscar OPs ativas (PENDING ou IN_PROGRESS)
  const activeOPs = await prisma.productionOrder.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    orderBy: { number: 'asc' }, // FIFO
    include: {
      order: { select: { id: true, status: true } },
    },
  })

  if (activeOPs.length === 0) return

  // Agrupar por produto
  const productIds = [...new Set(activeOPs.map((op) => op.productId))]

  // Calcular estoque disponível por produto
  const stockByProduct = new Map<string, number>()
  for (const productId of productIds) {
    const stock = await getAvailableStockForProduct(productId)
    stockByProduct.set(productId, stock)
  }

  // Aplicar FIFO por produto: OPs mais antigas têm prioridade
  const remainingStock = new Map(stockByProduct)
  const updates: { id: string; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; completedAt: Date | null }[] = []

  for (const op of activeOPs) {
    const available = remainingStock.get(op.productId) || 0

    let newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
    let completedAt: Date | null = null

    if (available >= op.quantityPieces) {
      newStatus = 'COMPLETED'
      completedAt = new Date()
      remainingStock.set(op.productId, available - op.quantityPieces)
    } else if (available > 0) {
      newStatus = 'IN_PROGRESS'
      remainingStock.set(op.productId, 0) // Consumiu todo o disponível
    } else {
      newStatus = 'PENDING'
    }

    if (newStatus !== op.status) {
      updates.push({ id: op.id, status: newStatus, completedAt })
    }
  }

  // Aplicar updates
  if (updates.length > 0) {
    for (const update of updates) {
      await prisma.productionOrder.update({
        where: { id: update.id },
        data: {
          status: update.status,
          completedAt: update.completedAt,
        },
      })
    }

    // Verificar se algum pedido teve TODAS as OPs concluídas → READY
    const affectedOrderIds = [...new Set(activeOPs.map((op) => op.order.id))]
    for (const oid of affectedOrderIds) {
      const order = await prisma.order.findUnique({ where: { id: oid } })
      if (!order || order.status !== 'IN_PRODUCTION') continue

      const allOPs = await prisma.productionOrder.findMany({
        where: { orderId: oid },
      })

      const allCompleted = allOPs.every(
        (op) => op.status === 'COMPLETED' || op.status === 'CANCELLED'
      )

      if (allCompleted) {
        await prisma.order.update({
          where: { id: oid },
          data: { status: 'READY' },
        })
      }
    }

  }
}

// ===== Listagem paginada =====

export async function getProductionOrdersPaginated(params: ProductionOrderPaginationParams) {
  const { page, pageSize, search, status, orderId, dateFrom, dateTo, sortBy, sortOrder } = params

  // Avaliação lazy antes de listar
  await checkAndUpdateProductionOrderStatuses()

  const where: Prisma.ProductionOrderWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as Prisma.ProductionOrderWhereInput['status']
  }

  if (orderId) {
    where.orderId = orderId
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { product: { name: { contains: search } } },
      { order: { customer: { companyName: { contains: search } } } },
      { order: { customer: { tradeName: { contains: search } } } },
      ...(searchNum
        ? [
            { number: searchNum },
            { order: { number: searchNum } },
          ]
        : []),
    ]
  }

  let orderByClause: Prisma.ProductionOrderOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderByClause = { number: sortOrder || 'desc' }
        break
      case 'order':
        orderByClause = { order: { number: sortOrder || 'desc' } }
        break
      case 'product':
        orderByClause = { product: { name: sortOrder || 'asc' } }
        break
      case 'status':
        orderByClause = { status: sortOrder || 'asc' }
        break
      case 'createdAt':
        orderByClause = { createdAt: sortOrder || 'desc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      orderBy: orderByClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            number: true,
            customer: { select: { companyName: true, tradeName: true } },
          },
        },
        product: { select: { name: true } },
        orderItem: { select: { quantity: true, unit: true } },
      },
    }),
    prisma.productionOrder.count({ where }),
  ])

  // Calcular estoque atual por produto para a coluna "Estoque"
  const productIds = [...new Set(data.map((op) => op.productId))]
  const stockMap = new Map<string, number>()
  for (const pid of productIds) {
    stockMap.set(pid, await getAvailableStockForProduct(pid))
  }

  return {
    data: data.map((op) => ({
      id: op.id,
      number: op.number,
      orderId: op.orderId,
      orderNumber: op.order.number,
      customerName: op.order.customer.tradeName || op.order.customer.companyName,
      productId: op.productId,
      productName: op.product.name,
      quantityPieces: op.quantityPieces,
      stockAtCreation: op.stockAtCreation,
      toProducePieces: op.toProducePieces,
      currentStock: stockMap.get(op.productId) || 0,
      status: op.status,
      notes: op.notes,
      completedAt: op.completedAt?.toISOString() || null,
      createdAt: op.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== KPIs =====

export async function getProductionOrderKPIs(): Promise<ProductionOrderKPIs> {
  const [total, pending, inProgress, completed] = await Promise.all([
    prisma.productionOrder.count(),
    prisma.productionOrder.count({ where: { status: 'PENDING' } }),
    prisma.productionOrder.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.productionOrder.count({ where: { status: 'COMPLETED' } }),
  ])

  // Peças pendentes = soma de quantityPieces das OPs PENDING e IN_PROGRESS
  const pendingOPs = await prisma.productionOrder.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    select: { quantityPieces: true },
  })
  const pendingPieces = pendingOPs.reduce((sum, op) => sum + op.quantityPieces, 0)

  return { total, pending, inProgress, completed, pendingPieces }
}

// ===== Cancelar OP individual =====

export async function cancelProductionOrder(id: string) {
  const op = await prisma.productionOrder.findUniqueOrThrow({ where: { id } })
  if (op.status === 'COMPLETED' || op.status === 'CANCELLED') {
    throw new Error('Apenas ordens pendentes ou em progresso podem ser canceladas')
  }

  await prisma.productionOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  revalidatePath('/producao/ordens')
  revalidatePath('/comercial/pedidos')
}

// ===== Cancelar todas as OPs de um pedido =====

export async function cancelAllForOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  await prisma.$transaction(async (tx) => {
    // Cancelar todas as OPs ativas
    await tx.productionOrder.updateMany({
      where: {
        orderId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: { status: 'CANCELLED' },
    })

    // Reverter status do pedido para CONFIRMED
    if (order.status === 'IN_PRODUCTION') {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      })
    }
  })

  revalidatePath('/producao/ordens')
  revalidatePath('/comercial/pedidos')
}
