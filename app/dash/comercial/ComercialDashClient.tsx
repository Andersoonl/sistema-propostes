'use client'

import { useState } from 'react'
import { MonthPicker } from '@/app/components/DatePicker'
import {
  getCommercialKPIs,
  getMonthlyVolume,
  getConversionFunnel,
  getTopCustomers,
  getTopProducts,
  type CommercialKPIs,
  type MonthlyVolume,
  type FunnelStep,
  type TopCustomer,
  type TopProduct,
} from '@/app/actions/commercial-dashboard'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { fmtMoney, fmtInt, fmtPct, fmtMax } from '@/lib/format'

interface Props {
  initialYear: number
  initialMonth: number
  initialKPIs: CommercialKPIs
  initialMonthlyVolume: MonthlyVolume[]
  initialFunnel: FunnelStep[]
  initialTopCustomers: TopCustomer[]
  initialTopProducts: TopProduct[]
}

export function ComercialDashClient({
  initialYear,
  initialMonth,
  initialKPIs,
  initialMonthlyVolume,
  initialFunnel,
  initialTopCustomers,
  initialTopProducts,
}: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [kpis, setKpis] = useState<CommercialKPIs>(initialKPIs)
  const [monthlyVolume, setMonthlyVolume] = useState<MonthlyVolume[]>(initialMonthlyVolume)
  const [funnel, setFunnel] = useState<FunnelStep[]>(initialFunnel)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>(initialTopCustomers)
  const [topProducts, setTopProducts] = useState<TopProduct[]>(initialTopProducts)
  const [loading, setLoading] = useState(false)

  const handleMonthChange = async (y: number, m: number) => {
    setYear(y)
    setMonth(m)
    setLoading(true)
    try {
      const [k, vol, fun, tc, tp] = await Promise.all([
        getCommercialKPIs(y, m),
        getMonthlyVolume(y, m),
        getConversionFunnel(y, m),
        getTopCustomers(y, m),
        getTopProducts(y, m),
      ])
      setKpis(k)
      setMonthlyVolume(vol)
      setFunnel(fun)
      setTopCustomers(tc)
      setTopProducts(tp)
    } finally {
      setLoading(false)
    }
  }

  // Funil: calcular largura proporcional ao máximo
  const funnelMax = Math.max(...funnel.map((f) => f.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Comercial</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      {loading && (
        <div className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-md">Carregando...</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Orçamentos" value={fmtInt(kpis.totalQuotes)} color="text-[#2d3e7e]" />
        <KPICard label="Pedidos" value={fmtInt(kpis.totalOrders)} color="text-[#3bbfb5]" />
        <KPICard label="Tx. Conversão" value={fmtPct(kpis.conversionRate)} color="text-green-600" />
        <KPICard label="Ticket Médio" value={fmtMoney(kpis.avgQuoteValue)} color="text-[#2d3e7e]" small />
        <KPICard label="Tempo Resposta" value={`${fmtMax(kpis.avgResponseDays, 1)} dias`} color="text-amber-600" />
        <KPICard label="Faturamento" value={fmtMoney(kpis.totalRevenue)} color="text-green-700" small />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Mensal */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Volume Mensal (12 meses)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyVolume} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="quotes" name="Orçamentos" fill="#2d3e7e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="orders" name="Pedidos" fill="#3bbfb5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funil de Conversão */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Funil de Conversão
          </h2>
          <div className="space-y-3">
            {funnel.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-24 text-right">{step.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max((step.count / funnelMax) * 100, step.count > 0 ? 8 : 0)}%`,
                      backgroundColor: step.color,
                    }}
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-medium text-white drop-shadow">
                    {step.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Top 10 Clientes por Valor de Pedidos
          </h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem pedidos no período</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={120}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '...' : v}
                  />
                  <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                  <Bar dataKey="value" name="Valor" radius={[0, 3, 3, 0]}>
                    {topCustomers.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? '#2d3e7e' : '#3d4f8e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Produtos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
            Top 10 Produtos Mais Cotados
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem orçamentos no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">#</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Produto</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Categoria</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Cotações</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Qtd Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="py-2 px-2 text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-2 px-2 text-gray-900 font-medium">{p.name}</td>
                      <td className="py-2 px-2 text-gray-500 text-xs">{p.category || '-'}</td>
                      <td className="py-2 px-2 text-right text-[#2d3e7e] font-medium">{fmtInt(p.quotedCount)}</td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        {fmtMax(p.totalQty, 2)} {p.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Componente KPI =====

function KPICard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold ${color} mt-1`}>{value}</div>
    </div>
  )
}
