'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  createPayableSchema,
  updatePayableSchema,
  payablePaymentSchema,
  type CreatePayableInput,
  type UpdatePayableInput,
  type PayablePaymentInput,
} from '@/lib/validators/payable'
import type { PayableStatus, PayableCategory, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface PayablePaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  category?: string
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PayableKPIs {
  totalPending: number
  totalOverdue: number
  totalPaidMonth: number
  totalAmount: number
}

// ===== Expiração automática =====

async function expireOverduePayables() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.payable.updateMany({
    where: {
      dueDate: { lt: today },
      status: 'PENDING',
    },
    data: { status: 'OVERDUE' },
  })
}

// ===== Listagem paginada =====

export async function getPayablesPaginated(params: PayablePaginationParams) {
  await expireOverduePayables()
  const { page, pageSize, search, status, category, supplierId, dateFrom, dateTo, sortBy, sortOrder } = params

  const where: Prisma.PayableWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as PayableStatus
  }

  if (category && category !== 'ALL') {
    where.category = category as PayableCategory
  }

  if (supplierId) {
    where.supplierId = supplierId
  }

  if (dateFrom || dateTo) {
    where.dueDate = {}
    if (dateFrom) (where.dueDate as Prisma.DateTimeFilter).gte = new Date(dateFrom)
    if (dateTo) (where.dueDate as Prisma.DateTimeFilter).lte = new Date(dateTo + 'T23:59:59')
  }

  if (search) {
    const searchNum = parseInt(search.replace(/\D/g, ''), 10)
    where.OR = [
      { supplier: { companyName: { contains: search } } },
      { supplier: { tradeName: { contains: search } } },
      { description: { contains: search } },
      ...(searchNum ? [{ number: searchNum }] : []),
    ]
  }

  let orderBy: Prisma.PayableOrderByWithRelationInput = { number: 'desc' }
  if (sortBy) {
    switch (sortBy) {
      case 'number':
        orderBy = { number: sortOrder || 'desc' }
        break
      case 'supplier':
        orderBy = { supplier: { companyName: sortOrder || 'asc' } }
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
      case 'category':
        orderBy = { category: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.payable.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        supplier: { select: { id: true, companyName: true, tradeName: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.payable.count({ where }),
  ])

  return {
    data: data.map((p) => ({
      ...p,
      issueDate: p.issueDate.toISOString(),
      dueDate: p.dueDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== KPIs =====

export async function getPayableKPIs(): Promise<PayableKPIs> {
  await expireOverduePayables()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  // Buscar saldos pendentes reais (totalAmount - paidAmount) para contas ativas
  const [pendingAgg, overdueAgg, paidMonthAgg, totalAgg] = await Promise.all([
    prisma.payable.aggregate({
      where: { status: { in: ['PENDING', 'PARTIAL'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.payable.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.payablePayment.aggregate({
      where: {
        paymentDate: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.payable.aggregate({
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

export async function getActiveSuppliers() {
  return prisma.supplier.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, companyName: true, tradeName: true },
    orderBy: { companyName: 'asc' },
  })
}

// ===== Criar =====

export async function createPayable(data: CreatePayableInput) {
  const parsed = createPayableSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { supplierId, category, description, invoiceNumber, issueDate, dueDate, totalAmount, notes } = parsed.data

  const payable = await prisma.$transaction(async (tx) => {
    const last = await tx.payable.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const nextNumber = (last?.number ?? 0) + 1

    return tx.payable.create({
      data: {
        number: nextNumber,
        supplierId: supplierId || null,
        category: category as PayableCategory,
        description: description || null,
        invoiceNumber: invoiceNumber || null,
        issueDate: new Date(issueDate + 'T12:00:00'),
        dueDate: new Date(dueDate + 'T12:00:00'),
        totalAmount,
        notes: notes || null,
      },
    })
  })

  revalidatePath('/financeiro/pagar')
  return payable
}

// ===== Atualizar =====

export async function updatePayable(id: string, data: UpdatePayableInput) {
  const parsed = updatePayableSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const existing = await prisma.payable.findUniqueOrThrow({ where: { id } })
  if (!['PENDING', 'OVERDUE'].includes(existing.status)) {
    throw new Error('Apenas contas pendentes ou vencidas podem ser editadas')
  }

  const { supplierId, category, description, invoiceNumber, issueDate, dueDate, totalAmount, notes } = parsed.data

  const dueDateObj = new Date(dueDate + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const newStatus = dueDateObj < today ? 'OVERDUE' : 'PENDING'

  await prisma.payable.update({
    where: { id },
    data: {
      supplierId: supplierId || null,
      category: category as PayableCategory,
      description: description || null,
      invoiceNumber: invoiceNumber || null,
      issueDate: new Date(issueDate + 'T12:00:00'),
      dueDate: dueDateObj,
      totalAmount,
      notes: notes || null,
      status: newStatus as PayableStatus,
    },
  })

  revalidatePath('/financeiro/pagar')
}

// ===== Excluir =====

export async function deletePayable(id: string) {
  const payable = await prisma.payable.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { payments: true } } },
  })

  if (payable.status === 'PAID') {
    throw new Error('Contas pagas não podem ser excluídas')
  }

  if (payable._count.payments > 0) {
    throw new Error('Exclua os pagamentos antes de excluir a conta')
  }

  await prisma.payable.delete({ where: { id } })
  revalidatePath('/financeiro/pagar')
}

// ===== Cancelar =====

export async function cancelPayable(id: string) {
  const payable = await prisma.payable.findUniqueOrThrow({ where: { id } })
  if (payable.status === 'PAID' || payable.status === 'CANCELLED') {
    throw new Error('Conta já paga ou cancelada não pode ser cancelada')
  }

  await prisma.payable.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  revalidatePath('/financeiro/pagar')
}

// ===== Registrar pagamento =====

export async function addPayablePayment(payableId: string, data: PayablePaymentInput) {
  const parsed = payablePaymentSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { amount, paymentDate, paymentMethod, reference, notes } = parsed.data

  const payable = await prisma.payable.findUniqueOrThrow({ where: { id: payableId } })
  if (payable.status === 'PAID' || payable.status === 'CANCELLED') {
    throw new Error('Conta já paga ou cancelada não aceita pagamentos')
  }

  const remaining = payable.totalAmount - payable.paidAmount
  if (amount > remaining + 0.01) {
    throw new Error(`Valor excede o restante (${remaining.toFixed(2)})`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.payablePayment.create({
      data: {
        payableId,
        paymentDate: new Date(paymentDate + 'T12:00:00'),
        amount,
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
      },
    })

    const newPaidAmount = payable.paidAmount + amount
    const newStatus: PayableStatus = newPaidAmount >= payable.totalAmount - 0.01 ? 'PAID' : 'PARTIAL'

    await tx.payable.update({
      where: { id: payableId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    })
  })

  revalidatePath('/financeiro/pagar')
}

// ===== Excluir pagamento =====

export async function deletePayablePayment(paymentId: string) {
  const payment = await prisma.payablePayment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { payable: true },
  })

  const payable = payment.payable
  if (payable.status === 'CANCELLED') {
    throw new Error('Conta cancelada não pode ter pagamentos removidos')
  }

  await prisma.$transaction(async (tx) => {
    await tx.payablePayment.delete({ where: { id: paymentId } })

    const newPaidAmount = payable.paidAmount - payment.amount
    let newStatus: PayableStatus

    if (newPaidAmount <= 0.01) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      newStatus = payable.dueDate < today ? 'OVERDUE' : 'PENDING'
    } else {
      newStatus = 'PARTIAL'
    }

    await tx.payable.update({
      where: { id: payable.id },
      data: {
        paidAmount: Math.max(0, newPaidAmount),
        status: newStatus,
      },
    })
  })

  revalidatePath('/financeiro/pagar')
}

// ===== Buscar pagamentos de uma conta =====

export async function getPayablePayments(payableId: string) {
  const payments = await prisma.payablePayment.findMany({
    where: { payableId },
    orderBy: { paymentDate: 'desc' },
  })

  return payments.map((p) => ({
    ...p,
    paymentDate: p.paymentDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }))
}
