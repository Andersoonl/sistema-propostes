'use server'

import { prisma } from '@/lib/prisma'

// ===== Tipos =====

export interface CashFlowKPIs {
  totalIn: number       // Entradas no período (pagamentos recebidos)
  totalOut: number      // Saídas no período (pagamentos realizados)
  balance: number       // Saldo do período (entradas - saídas)
  pendingReceivable: number  // Pendente a receber (PENDING + OVERDUE + PARTIAL)
  pendingPayable: number     // Pendente a pagar (PENDING + OVERDUE + PARTIAL)
}

export interface CashFlowMovement {
  date: string          // ISO date
  type: 'IN' | 'OUT'
  description: string
  reference: string     // REC-0001 ou PAG-0001
  amount: number
  runningBalance: number
}

export interface CashFlowDayBalance {
  day: number
  balance: number
}

export interface CashFlowData {
  kpis: CashFlowKPIs
  movements: CashFlowMovement[]
  dailyBalance: CashFlowDayBalance[]
}

// ===== Dados consolidados =====

export async function getCashFlowData(year: number, month: number): Promise<CashFlowData> {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59))
  const daysInMonth = new Date(year, month, 0).getDate()

  // Buscar pagamentos recebidos no período
  const receivablePayments = await prisma.receivablePayment.findMany({
    where: {
      paymentDate: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      receivable: {
        select: {
          number: true,
          customer: { select: { companyName: true, tradeName: true } },
        },
      },
    },
    orderBy: { paymentDate: 'asc' },
  })

  // Buscar pagamentos efetuados no período
  const payablePayments = await prisma.payablePayment.findMany({
    where: {
      paymentDate: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      payable: {
        select: {
          number: true,
          description: true,
          supplier: { select: { companyName: true, tradeName: true } },
        },
      },
    },
    orderBy: { paymentDate: 'asc' },
  })

  // Calcular KPIs do período
  const totalIn = receivablePayments.reduce((sum, p) => sum + p.amount, 0)
  const totalOut = payablePayments.reduce((sum, p) => sum + p.amount, 0)

  // Pendentes (soma de totalAmount - paidAmount para contas ativas)
  const [pendingReceivableAgg, pendingPayableAgg] = await Promise.all([
    prisma.receivable.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.payable.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ])

  const pendingReceivable = (pendingReceivableAgg._sum.totalAmount || 0) - (pendingReceivableAgg._sum.paidAmount || 0)
  const pendingPayable = (pendingPayableAgg._sum.totalAmount || 0) - (pendingPayableAgg._sum.paidAmount || 0)

  const kpis: CashFlowKPIs = {
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    pendingReceivable,
    pendingPayable,
  }

  // Montar lista de movimentações
  const movements: CashFlowMovement[] = []

  for (const p of receivablePayments) {
    const customerName = p.receivable.customer.tradeName || p.receivable.customer.companyName
    movements.push({
      date: p.paymentDate.toISOString(),
      type: 'IN',
      description: `Recebimento — ${customerName}`,
      reference: `REC-${String(p.receivable.number).padStart(4, '0')}`,
      amount: p.amount,
      runningBalance: 0, // calculado abaixo
    })
  }

  for (const p of payablePayments) {
    const supplierName = p.payable.supplier
      ? (p.payable.supplier.tradeName || p.payable.supplier.companyName)
      : (p.payable.description || 'Despesa')
    movements.push({
      date: p.paymentDate.toISOString(),
      type: 'OUT',
      description: `Pagamento — ${supplierName}`,
      reference: `PAG-${String(p.payable.number).padStart(4, '0')}`,
      amount: p.amount,
      runningBalance: 0,
    })
  }

  // Ordenar por data
  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calcular saldo acumulado
  let runningBalance = 0
  for (const m of movements) {
    if (m.type === 'IN') {
      runningBalance += m.amount
    } else {
      runningBalance -= m.amount
    }
    m.runningBalance = Math.round(runningBalance * 100) / 100
  }

  // Calcular saldo diário para o gráfico
  const dailyIn = new Map<number, number>()
  const dailyOut = new Map<number, number>()

  for (const p of receivablePayments) {
    const day = p.paymentDate.getUTCDate()
    dailyIn.set(day, (dailyIn.get(day) || 0) + p.amount)
  }

  for (const p of payablePayments) {
    const day = p.paymentDate.getUTCDate()
    dailyOut.set(day, (dailyOut.get(day) || 0) + p.amount)
  }

  const dailyBalance: CashFlowDayBalance[] = []
  let accumulated = 0
  for (let d = 1; d <= daysInMonth; d++) {
    accumulated += (dailyIn.get(d) || 0) - (dailyOut.get(d) || 0)
    dailyBalance.push({
      day: d,
      balance: Math.round(accumulated * 100) / 100,
    })
  }

  return { kpis, movements, dailyBalance }
}
