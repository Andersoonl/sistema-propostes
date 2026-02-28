'use server'

import { prisma } from '@/lib/prisma'

// ===== Tipos =====

export interface CommercialKPIs {
  totalQuotes: number
  totalOrders: number
  conversionRate: number
  avgQuoteValue: number
  avgResponseDays: number
  totalRevenue: number
}

export interface MonthlyVolume {
  month: string // "Jan", "Fev", etc.
  quotes: number
  orders: number
}

export interface FunnelStep {
  label: string
  count: number
  color: string
}

export interface TopCustomer {
  name: string
  value: number
}

export interface TopProduct {
  name: string
  category: string | null
  quotedCount: number
  totalQty: number
  unit: string
}

// ===== Meses =====

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

// ===== KPIs do mês =====

export async function getCommercialKPIs(year: number, month: number): Promise<CommercialKPIs> {
  const { start, end } = getMonthRange(year, month)

  const [
    totalQuotes,
    totalOrders,
    approvedQuotes,
    quoteValueAgg,
    orderRevenueAgg,
    respondedQuotes,
  ] = await Promise.all([
    prisma.quote.count({ where: { date: { gte: start, lte: end } } }),
    prisma.order.count({ where: { orderDate: { gte: start, lte: end } } }),
    prisma.quote.count({ where: { date: { gte: start, lte: end }, status: 'APPROVED' } }),
    prisma.quote.aggregate({
      where: { date: { gte: start, lte: end } },
      _avg: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { orderDate: { gte: start, lte: end } },
      _sum: { totalAmount: true },
    }),
    // Orçamentos que foram aprovados ou recusados (tiveram resposta) no período
    prisma.quote.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      select: { createdAt: true, updatedAt: true },
    }),
  ])

  const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0

  let avgResponseDays = 0
  if (respondedQuotes.length > 0) {
    const totalDays = respondedQuotes.reduce((sum, q) => {
      const diffMs = q.updatedAt.getTime() - q.createdAt.getTime()
      return sum + diffMs / (1000 * 60 * 60 * 24)
    }, 0)
    avgResponseDays = totalDays / respondedQuotes.length
  }

  return {
    totalQuotes,
    totalOrders,
    conversionRate,
    avgQuoteValue: quoteValueAgg._avg.totalAmount || 0,
    avgResponseDays,
    totalRevenue: orderRevenueAgg._sum.totalAmount || 0,
  }
}

// ===== Volume mensal (últimos 12 meses) =====

export async function getMonthlyVolume(year: number, month: number): Promise<MonthlyVolume[]> {
  const result: MonthlyVolume[] = []

  for (let i = 11; i >= 0; i--) {
    let m = month - i
    let y = year
    while (m <= 0) { m += 12; y-- }

    const { start, end } = getMonthRange(y, m)

    const [quotes, orders] = await Promise.all([
      prisma.quote.count({ where: { date: { gte: start, lte: end } } }),
      prisma.order.count({ where: { orderDate: { gte: start, lte: end } } }),
    ])

    result.push({
      month: `${MONTH_NAMES[m - 1]}/${String(y).slice(2)}`,
      quotes,
      orders,
    })
  }

  return result
}

// ===== Funil de conversão =====

export async function getConversionFunnel(year: number, month: number): Promise<FunnelStep[]> {
  const { start, end } = getMonthRange(year, month)
  const where = { date: { gte: start, lte: end } }

  const [total, sent, approved, rejected, expired] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.count({ where: { ...where, status: { in: ['SENT', 'APPROVED', 'REJECTED'] } } }),
    prisma.quote.count({ where: { ...where, status: 'APPROVED' } }),
    prisma.quote.count({ where: { ...where, status: 'REJECTED' } }),
    prisma.quote.count({ where: { ...where, status: 'EXPIRED' } }),
  ])

  // Quantos aprovados viraram pedido
  const converted = await prisma.order.count({
    where: {
      orderDate: { gte: start, lte: end },
      quoteId: { not: null },
    },
  })

  return [
    { label: 'Criados', count: total, color: '#94a3b8' },
    { label: 'Enviados', count: sent, color: '#60a5fa' },
    { label: 'Aprovados', count: approved, color: '#34d399' },
    { label: 'Convertidos', count: converted, color: '#3bbfb5' },
    { label: 'Recusados', count: rejected, color: '#f87171' },
    { label: 'Expirados', count: expired, color: '#fbbf24' },
  ]
}

// ===== Top 10 clientes =====

export async function getTopCustomers(year: number, month: number): Promise<TopCustomer[]> {
  const { start, end } = getMonthRange(year, month)

  const orders = await prisma.order.findMany({
    where: { orderDate: { gte: start, lte: end } },
    select: {
      totalAmount: true,
      customer: { select: { companyName: true, tradeName: true } },
    },
  })

  const byCustomer: Record<string, number> = {}
  for (const o of orders) {
    const name = o.customer.tradeName || o.customer.companyName
    byCustomer[name] = (byCustomer[name] || 0) + o.totalAmount
  }

  return Object.entries(byCustomer)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

// ===== Top 10 produtos mais cotados =====

export async function getTopProducts(year: number, month: number): Promise<TopProduct[]> {
  const { start, end } = getMonthRange(year, month)

  const items = await prisma.quoteItem.findMany({
    where: { quote: { date: { gte: start, lte: end } } },
    select: {
      quantity: true,
      unit: true,
      product: { select: { id: true, name: true, category: true } },
    },
  })

  const byProduct: Record<string, { name: string; category: string | null; count: number; totalQty: number; unit: string }> = {}
  for (const item of items) {
    const key = item.product.id
    if (!byProduct[key]) {
      byProduct[key] = { name: item.product.name, category: item.product.category, count: 0, totalQty: 0, unit: item.unit === 'M2' ? 'm²' : 'pç' }
    }
    byProduct[key].count++
    byProduct[key].totalQty += item.quantity
  }

  return Object.values(byProduct)
    .map((p) => ({ name: p.name, category: p.category, quotedCount: p.count, totalQty: p.totalQty, unit: p.unit }))
    .sort((a, b) => b.quotedCount - a.quotedCount)
    .slice(0, 10)
}
