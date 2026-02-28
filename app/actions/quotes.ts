'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createQuoteSchema, updateQuoteSchema, type CreateQuoteInput, type UpdateQuoteInput } from '@/lib/validators/quote'
import type { QuoteStatus, QuantityUnit, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface QuotePaginationParams {
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

export interface QuoteKPIs {
  total: number
  drafts: number
  approved: number
  approvedValue: number
}

// ===== Expiração automática =====

async function expireOverdueQuotes() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.quote.updateMany({
    where: {
      validUntil: { lt: today },
      status: { in: ['DRAFT', 'SENT'] },
    },
    data: { status: 'EXPIRED' },
  })
}

// ===== Listagem =====

export async function getQuotesPaginated(params: QuotePaginationParams) {
  await expireOverdueQuotes()
  const { page, pageSize, search, status, customerId, dateFrom, dateTo, sortBy, sortOrder } = params

  const where: Prisma.QuoteWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as QuoteStatus
  }

  if (customerId) {
    where.customerId = customerId
  }

  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.date as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { customer: { companyName: { contains: search } } },
      { customer: { tradeName: { contains: search } } },
      ...(searchNum ? [{ number: searchNum }] : []),
    ]
  }

  let orderBy: Prisma.QuoteOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderBy = { number: sortOrder || 'desc' }
        break
      case 'customer':
        orderBy = { customer: { companyName: sortOrder || 'asc' } }
        break
      case 'date':
        orderBy = { date: sortOrder || 'desc' }
        break
      case 'validUntil':
        orderBy = { validUntil: sortOrder || 'asc' }
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
    prisma.quote.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, companyName: true, tradeName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.quote.count({ where }),
  ])

  return {
    data: data.map((q) => ({
      ...q,
      date: q.date.toISOString(),
      validUntil: q.validUntil.toISOString(),
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== Detalhe =====

export async function getQuoteById(id: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true, tradeName: true } },
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
        orderBy: { createdAt: 'asc' },
      },
      orders: { select: { id: true, number: true, status: true } },
    },
  })

  return {
    ...quote,
    date: quote.date.toISOString(),
    validUntil: quote.validUntil.toISOString(),
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    items: quote.items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

// ===== KPIs =====

export async function getQuoteKPIs(): Promise<QuoteKPIs> {
  await expireOverdueQuotes()
  const [total, drafts, approved, approvedAgg] = await Promise.all([
    prisma.quote.count(),
    prisma.quote.count({ where: { status: 'DRAFT' } }),
    prisma.quote.count({ where: { status: 'APPROVED' } }),
    prisma.quote.aggregate({
      where: { status: 'APPROVED' },
      _sum: { totalAmount: true },
    }),
  ])

  return {
    total,
    drafts,
    approved,
    approvedValue: approvedAgg._sum.totalAmount || 0,
  }
}

// ===== Dados auxiliares =====

export async function getActiveCustomers() {
  return prisma.customer.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, companyName: true, tradeName: true },
    orderBy: { companyName: 'asc' },
  })
}

export async function getProductsWithRecipe() {
  const products = await prisma.product.findMany({
    include: {
      costRecipe: { select: { piecesPerM2: true } },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    piecesPerM2: p.costRecipe?.piecesPerM2 || null,
    basePrice: p.basePrice,
    basePriceUnit: p.basePriceUnit,
  }))
}

// ===== Criar =====

export async function createQuote(data: CreateQuoteInput) {
  const parsed = createQuoteSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { customerId, validUntil, projectName, paymentTerms, paymentMethod, deliveryType, deliveryAddress, deliverySchedule, notes, items } = parsed.data

  const quote = await prisma.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    const totalAmount = items.reduce((sum, item) => {
      const discount = item.discount ?? 0
      return sum + item.quantity * item.unitPrice * (1 - discount / 100)
    }, 0)

    return tx.quote.create({
      data: {
        number: nextNumber,
        customerId,
        validUntil: new Date(validUntil),
        projectName: projectName || null,
        paymentTerms: paymentTerms || null,
        paymentMethod: paymentMethod || null,
        deliveryType: deliveryType || null,
        deliveryAddress: deliveryAddress || null,
        deliverySchedule: deliverySchedule || null,
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

  revalidatePath('/comercial/orcamentos')
  return quote
}

// ===== Atualizar =====

export async function updateQuote(id: string, data: UpdateQuoteInput) {
  const parsed = updateQuoteSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const existing = await prisma.quote.findUniqueOrThrow({ where: { id } })
  if (existing.status !== 'DRAFT') {
    throw new Error('Apenas orçamentos em rascunho podem ser editados')
  }

  const { customerId, validUntil, projectName, paymentTerms, paymentMethod, deliveryType, deliveryAddress, deliverySchedule, notes, items } = parsed.data
  const totalAmount = items.reduce((sum, item) => {
    const discount = item.discount ?? 0
    return sum + item.quantity * item.unitPrice * (1 - discount / 100)
  }, 0)

  await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({ where: { quoteId: id } })

    await tx.quote.update({
      where: { id },
      data: {
        customerId,
        validUntil: new Date(validUntil),
        projectName: projectName || null,
        paymentTerms: paymentTerms || null,
        paymentMethod: paymentMethod || null,
        deliveryType: deliveryType || null,
        deliveryAddress: deliveryAddress || null,
        deliverySchedule: deliverySchedule || null,
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

  revalidatePath('/comercial/orcamentos')
}

// ===== Mudar status =====

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT'],
  SENT: ['APPROVED', 'REJECTED'],
}

export async function updateQuoteStatus(id: string, newStatus: QuoteStatus) {
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id } })

  // Qualquer status pode virar EXPIRED
  if (newStatus !== 'EXPIRED') {
    const allowed = VALID_TRANSITIONS[quote.status]
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(`Transição de ${quote.status} para ${newStatus} não é permitida`)
    }
  }

  await prisma.quote.update({
    where: { id },
    data: { status: newStatus },
  })

  revalidatePath('/comercial/orcamentos')
}

// ===== Excluir =====

export async function deleteQuote(id: string) {
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id } })
  if (quote.status !== 'DRAFT') {
    throw new Error('Apenas orçamentos em rascunho podem ser excluídos')
  }

  await prisma.quote.delete({ where: { id } })
  revalidatePath('/comercial/orcamentos')
}

// ===== Duplicar =====

export async function duplicateQuote(id: string) {
  const original = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  })

  const quote = await prisma.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    // Validade = hoje + 30 dias
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    return tx.quote.create({
      data: {
        number: nextNumber,
        customerId: original.customerId,
        validUntil,
        projectName: original.projectName,
        paymentTerms: original.paymentTerms,
        paymentMethod: original.paymentMethod,
        deliveryType: original.deliveryType,
        deliveryAddress: original.deliveryAddress,
        deliverySchedule: original.deliverySchedule,
        notes: original.notes,
        totalAmount: original.totalAmount,
        status: 'DRAFT',
        items: {
          create: original.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal,
          })),
        },
      },
    })
  })

  revalidatePath('/comercial/orcamentos')
  return quote
}

// ===== Converter em Pedido =====

export async function convertQuoteToOrder(quoteId: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { items: true },
  })

  if (quote.status !== 'APPROVED') {
    throw new Error('Apenas orçamentos aprovados podem ser convertidos em pedido')
  }

  const order = await prisma.$transaction(async (tx) => {
    const lastOrder = await tx.order.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (lastOrder?.number ?? 0) + 1

    return tx.order.create({
      data: {
        number: nextNumber,
        quoteId: quote.id,
        customerId: quote.customerId,
        paymentTerms: quote.paymentTerms,
        notes: quote.notes,
        totalAmount: quote.totalAmount,
        status: 'CONFIRMED',
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal,
          })),
        },
      },
    })
  })

  revalidatePath('/comercial/orcamentos')
  revalidatePath('/comercial/pedidos')
  return order
}
