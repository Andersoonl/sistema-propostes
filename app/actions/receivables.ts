'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  createReceivableSchema,
  updateReceivableSchema,
  receivablePaymentSchema,
  type CreateReceivableInput,
  type UpdateReceivableInput,
  type ReceivablePaymentInput,
} from '@/lib/validators/receivable'
import type { ReceivableStatus, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface ReceivablePaginationParams {
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

export interface ReceivableKPIs {
  totalPending: number
  totalOverdue: number
  totalPaidMonth: number
  totalAmount: number
}

// ===== Expiração automática =====

async function expireOverdueReceivables() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.receivable.updateMany({
    where: {
      dueDate: { lt: today },
      status: 'PENDING',
    },
    data: { status: 'OVERDUE' },
  })
}

// ===== Listagem paginada =====

export async function getReceivablesPaginated(params: ReceivablePaginationParams) {
  await expireOverdueReceivables()
  const { page, pageSize, search, status, customerId, dateFrom, dateTo, sortBy, sortOrder } = params

  const where: Prisma.ReceivableWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as ReceivableStatus
  }

  if (customerId) {
    where.customerId = customerId
  }

  if (dateFrom || dateTo) {
    where.dueDate = {}
    if (dateFrom) (where.dueDate as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.dueDate as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { customer: { companyName: { contains: search } } },
      { customer: { tradeName: { contains: search } } },
      { description: { contains: search } },
      ...(searchNum ? [{ number: searchNum }] : []),
    ]
  }

  let orderBy: Prisma.ReceivableOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderBy = { number: sortOrder || 'desc' }
        break
      case 'customer':
        orderBy = { customer: { companyName: sortOrder || 'asc' } }
        break
      case 'issueDate':
        orderBy = { issueDate: sortOrder || 'desc' }
        break
      case 'dueDate':
        orderBy = { dueDate: sortOrder || 'asc' }
        break
      case 'totalAmount':
        orderBy = { totalAmount: sortOrder || 'desc' }
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.receivable.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, companyName: true, tradeName: true } },
        order: { select: { number: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.receivable.count({ where }),
  ])

  return {
    data: data.map((r) => ({
      ...r,
      issueDate: r.issueDate.toISOString(),
      dueDate: r.dueDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== KPIs =====

export async function getReceivableKPIs(): Promise<ReceivableKPIs> {
  await expireOverdueReceivables()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Buscar saldos pendentes reais (totalAmount - paidAmount) para contas ativas
  const [pendingAgg, overdueAgg, paidMonthAgg, totalAgg] = await Promise.all([
    prisma.receivable.aggregate({
      where: { status: { in: ['PENDING', 'PARTIAL'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.receivable.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.receivablePayment.aggregate({
      where: {
        paymentDate: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.receivable.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
  ])

  return {
    totalPending: (pendingAgg._sum.totalAmount || 0) - (pendingAgg._sum.paidAmount || 0),
    totalOverdue: (overdueAgg._sum.totalAmount || 0) - (overdueAgg._sum.paidAmount || 0),
    totalPaidMonth: paidMonthAgg._sum.amount || 0,
    totalAmount: totalAgg._sum.totalAmount || 0,
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

export async function getReadyOrdersForReceivable() {
  // Pedidos DELIVERED que ainda não têm conta a receber
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      receivables: { none: {} },
    },
    select: {
      id: true,
      number: true,
      totalAmount: true,
      customer: { select: { id: true, companyName: true, tradeName: true } },
    },
    orderBy: { number: 'desc' },
  })

  return orders
}

// ===== Criar =====

export async function createReceivable(data: CreateReceivableInput) {
  const parsed = createReceivableSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { orderId, customerId, description, invoiceNumber, issueDate, dueDate, totalAmount, notes } = parsed.data

  const receivable = await prisma.$transaction(async (tx) => {
    const last = await tx.receivable.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    return tx.receivable.create({
      data: {
        number: nextNumber,
        orderId: orderId || null,
        customerId,
        description: description || null,
        invoiceNumber: invoiceNumber || null,
        issueDate: new Date(issueDate + 'T12:00:00'),
        dueDate: new Date(dueDate + 'T12:00:00'),
        totalAmount,
        notes: notes || null,
      },
    })
  })

  revalidatePath('/financeiro/receber')
  return receivable
}

// ===== Atualizar =====

export async function updateReceivable(id: string, data: UpdateReceivableInput) {
  const parsed = updateReceivableSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const existing = await prisma.receivable.findUniqueOrThrow({ where: { id } })
  if (!['PENDING', 'OVERDUE'].includes(existing.status)) {
    throw new Error('Apenas contas pendentes ou vencidas podem ser editadas')
  }

  const { orderId, customerId, description, invoiceNumber, issueDate, dueDate, totalAmount, notes } = parsed.data

  // Determinar novo status baseado na dueDate
  const dueDateObj = new Date(dueDate + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const newStatus = dueDateObj < today ? 'OVERDUE' : 'PENDING'

  await prisma.receivable.update({
    where: { id },
    data: {
      orderId: orderId || null,
      customerId,
      description: description || null,
      invoiceNumber: invoiceNumber || null,
      issueDate: new Date(issueDate + 'T12:00:00'),
      dueDate: dueDateObj,
      totalAmount,
      notes: notes || null,
      status: newStatus as ReceivableStatus,
    },
  })

  revalidatePath('/financeiro/receber')
}

// ===== Excluir =====

export async function deleteReceivable(id: string) {
  const receivable = await prisma.receivable.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { payments: true } } },
  })

  if (receivable.status === 'PAID') {
    throw new Error('Contas pagas não podem ser excluídas')
  }

  if (receivable._count.payments > 0) {
    throw new Error('Exclua os pagamentos antes de excluir a conta')
  }

  await prisma.receivable.delete({ where: { id } })
  revalidatePath('/financeiro/receber')
}

// ===== Cancelar =====

export async function cancelReceivable(id: string) {
  const receivable = await prisma.receivable.findUniqueOrThrow({ where: { id } })
  if (receivable.status === 'PAID' || receivable.status === 'CANCELLED') {
    throw new Error('Conta já paga ou cancelada não pode ser cancelada')
  }

  await prisma.receivable.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  revalidatePath('/financeiro/receber')
}

// ===== Registrar pagamento =====

export async function addReceivablePayment(receivableId: string, data: ReceivablePaymentInput) {
  const parsed = receivablePaymentSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { amount, paymentDate, paymentMethod, reference, notes } = parsed.data

  const receivable = await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })
  if (receivable.status === 'PAID' || receivable.status === 'CANCELLED') {
    throw new Error('Conta já paga ou cancelada não aceita pagamentos')
  }

  const remaining = receivable.totalAmount - receivable.paidAmount
  if (amount > remaining + 0.01) {
    throw new Error(`Valor excede o restante (${remaining.toFixed(2)})`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.receivablePayment.create({
      data: {
        receivableId,
        paymentDate: new Date(paymentDate + 'T12:00:00'),
        amount,
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
      },
    })

    const newPaidAmount = receivable.paidAmount + amount
    const newStatus: ReceivableStatus = newPaidAmount >= receivable.totalAmount - 0.01 ? 'PAID' : 'PARTIAL'

    await tx.receivable.update({
      where: { id: receivableId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    })
  })

  revalidatePath('/financeiro/receber')
}

// ===== Excluir pagamento =====

export async function deleteReceivablePayment(paymentId: string) {
  const payment = await prisma.receivablePayment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { receivable: true },
  })

  const receivable = payment.receivable
  if (receivable.status === 'CANCELLED') {
    throw new Error('Conta cancelada não pode ter pagamentos removidos')
  }

  await prisma.$transaction(async (tx) => {
    await tx.receivablePayment.delete({ where: { id: paymentId } })

    const newPaidAmount = receivable.paidAmount - payment.amount
    let newStatus: ReceivableStatus

    if (newPaidAmount <= 0.01) {
      // Sem pagamentos — verificar se está vencida
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      newStatus = receivable.dueDate < today ? 'OVERDUE' : 'PENDING'
    } else {
      newStatus = 'PARTIAL'
    }

    await tx.receivable.update({
      where: { id: receivable.id },
      data: {
        paidAmount: Math.max(0, newPaidAmount),
        status: newStatus,
      },
    })
  })

  revalidatePath('/financeiro/receber')
}

// ===== Buscar pagamentos de uma conta =====

export async function getReceivablePayments(receivableId: string) {
  const payments = await prisma.receivablePayment.findMany({
    where: { receivableId },
    orderBy: { paymentDate: 'desc' },
  })

  return payments.map((p) => ({
    ...p,
    paymentDate: p.paymentDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }))
}
