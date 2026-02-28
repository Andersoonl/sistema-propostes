'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/order'
import { checkAndUpdateProductionOrderStatuses } from '@/app/actions/production-orders'
import type { OrderStatus, QuantityUnit, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface OrderPaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface OrderKPIs {
  total: number
  confirmed: number
  inProduction: number
  ready: number
}

// ===== Listagem =====

export async function getOrdersPaginated(params: OrderPaginationParams) {
  const { page, pageSize, search, status, customerId, dateFrom, dateTo, sortBy, sortOrder } = params

  // Avaliação lazy: atualizar status das OPs antes de listar
  await checkAndUpdateProductionOrderStatuses()

  const where: Prisma.OrderWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as OrderStatus
  }

  if (customerId) {
    where.customerId = customerId
  }

  if (dateFrom || dateTo) {
    where.orderDate = {}
    if (dateFrom) (where.orderDate as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.orderDate as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { customer: { companyName: { contains: search } } },
      { customer: { tradeName: { contains: search } } },
      ...(searchNum ? [{ number: searchNum }] : []),
    ]
  }

  let orderBy: Prisma.OrderOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderBy = { number: sortOrder || 'desc' }
        break
      case 'customer':
        orderBy = { customer: { companyName: sortOrder || 'asc' } }
        break
      case 'orderDate':
        orderBy = { orderDate: sortOrder || 'desc' }
        break
      case 'deliveryDate':
        orderBy = { deliveryDate: sortOrder || 'asc' }
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
      case 'totalAmount':
        orderBy = { totalAmount: sortOrder || 'desc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, companyName: true, tradeName: true } },
        quote: { select: { number: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return {
    data: data.map((o) => ({
      ...o,
      orderDate: o.orderDate.toISOString(),
      deliveryDate: o.deliveryDate?.toISOString() || null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== Detalhe =====

export async function getOrderById(id: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true, tradeName: true } },
      quote: { select: { id: true, number: true } },
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return {
    ...order,
    orderDate: order.orderDate.toISOString(),
    deliveryDate: order.deliveryDate?.toISOString() || null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

// ===== KPIs =====

export async function getOrderKPIs(): Promise<OrderKPIs> {
  const [total, confirmed, inProduction, ready] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'CONFIRMED' } }),
    prisma.order.count({ where: { status: 'IN_PRODUCTION' } }),
    prisma.order.count({ where: { status: 'READY' } }),
  ])

  return { total, confirmed, inProduction, ready }
}

// ===== Criar pedido avulso =====

export async function createStandaloneOrder(data: CreateOrderInput) {
  const parsed = createOrderSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { customerId, deliveryDate, paymentTerms, notes, items } = parsed.data

  const order = await prisma.$transaction(async (tx) => {
    const last = await tx.order.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    const totalAmount = items.reduce((sum, item) => {
      const discount = item.discount ?? 0
      return sum + item.quantity * item.unitPrice * (1 - discount / 100)
    }, 0)

    return tx.order.create({
      data: {
        number: nextNumber,
        customerId,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        totalAmount,
        status: 'CONFIRMED',
        items: {
          create: items.map((item) => {
            const discount = item.discount ?? 0
            return {
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit as QuantityUnit,
              unitPrice: item.unitPrice,
              discount,
              subtotal: item.quantity * item.unitPrice * (1 - discount / 100),
            }
          }),
        },
      },
    })
  })

  revalidatePath('/comercial/pedidos')
  return order
}

// ===== Atualizar pedido =====

export async function updateOrder(id: string, data: CreateOrderInput) {
  const parsed = createOrderSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const existing = await prisma.order.findUniqueOrThrow({ where: { id } })
  if (existing.status !== 'CONFIRMED') {
    throw new Error('Apenas pedidos confirmados podem ser editados')
  }

  const { customerId, deliveryDate, paymentTerms, notes, items } = parsed.data
  const totalAmount = items.reduce((sum, item) => {
    const discount = item.discount ?? 0
    return sum + item.quantity * item.unitPrice * (1 - discount / 100)
  }, 0)

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } })

    await tx.order.update({
      where: { id },
      data: {
        customerId,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        totalAmount,
        items: {
          create: items.map((item) => {
            const discount = item.discount ?? 0
            return {
              productId: item.productId,
              quantity: item.quantity,
              unit: item.unit as QuantityUnit,
              unitPrice: item.unitPrice,
              discount,
              subtotal: item.quantity * item.unitPrice * (1 - discount / 100),
            }
          }),
        },
      },
    })
  })

  revalidatePath('/comercial/pedidos')
}

// ===== Mudar status =====

const VALID_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ['CANCELLED'], // CONFIRMED → IN_PRODUCTION é automático via generateProductionOrders
  IN_PRODUCTION: ['CANCELLED'], // IN_PRODUCTION → READY é automático via checkAndUpdateProductionOrderStatuses
  READY: ['CANCELLED'], // READY → DELIVERED é automático via entregas (logística)
}

export async function updateOrderStatus(id: string, newStatus: OrderStatus) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id } })

  const allowed = VALID_TRANSITIONS[order.status]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Transição de ${order.status} para ${newStatus} não é permitida`)
  }

  await prisma.order.update({
    where: { id },
    data: { status: newStatus },
  })

  revalidatePath('/comercial/pedidos')
}

// ===== Excluir pedido =====

export async function deleteOrder(id: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id } })
  if (order.status !== 'CONFIRMED') {
    throw new Error('Apenas pedidos confirmados podem ser excluídos')
  }

  // Verificar se tem OPs vinculadas
  const opCount = await prisma.productionOrder.count({ where: { orderId: id } })
  if (opCount > 0) {
    throw new Error('Este pedido possui ordens de produção. Cancele as OPs antes de excluir.')
  }

  await prisma.order.delete({ where: { id } })
  revalidatePath('/comercial/pedidos')
}
