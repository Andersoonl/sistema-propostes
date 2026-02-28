'use client'

import { useState } from 'react'
import { MonthPicker } from '@/app/components/DatePicker'
import { getMonthlyProductionData, getMonthlySummary, getMonthlyProductPiecesSummary, getMonthlyDowntimeData, getDowntimePareto } from '@/app/actions/dashboard'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { formatMinutes } from '@/lib/shift'
import { fmtInt, fmtMax, fmtDec } from '@/lib/format'

interface MonthlyProductionData {
  date: string
  VP1: number
  VP2: number
  HZEN: number
  total: number
  VP1Pieces: number
  VP2Pieces: number
  HZENPieces: number
  totalPieces: number
  VP1Pallets: number
  VP2Pallets: number
  HZENPallets: number
  totalPallets: number
  VP1M2: number
  VP2M2: number
  HZENM2: number
  totalM2: number
  hasProduction: boolean
}

interface DailySummary {
  date: string
  dayOfWeek: number
  machineId: string
  machineName: string
  shiftMinutes: number
  productionCycles: number
  productionPieces: number
  downtimeMinutes: number
  availableMinutes: number
  hasProduction: boolean
}

interface ProductPiecesSummary {
  productId: string
  productName: string
  totalCycles: number
  totalPieces: number
  totalPallets: number
  totalM2: number
  machineBreakdown: {
    machineName: string
    cycles: number
    pieces: number
  }[]
}

interface MonthlyDowntimeData {
  reasonNV1: string
  reasonNV2: string
  reasonNV3: string
  totalMinutes: number
  count: number
}

interface ParetoData {
  reason: string
  minutes: number
  percentage: number
  cumulativePercentage: number
}

interface ProductionDashClientProps {
  initialYear: number
  initialMonth: number
  initialProductionData: MonthlyProductionData[]
  initialSummary: DailySummary[]
  initialProductPieces: ProductPiecesSummary[]
  initialDowntimeData: MonthlyDowntimeData[]
  initialParetoNV1: ParetoData[]
}

type ChartUnit = 'cycles' | 'pieces' | 'pallets' | 'm2'

const UNIT_CONFIG: Record<ChartUnit, { label: string; keys: { hzen: string; vp1: string; vp2: string; total: string } }> = {
  cycles: { label: 'Ciclos', keys: { hzen: 'HZEN', vp1: 'VP1', vp2: 'VP2', total: 'total' } },
  pieces: { label: 'Peças', keys: { hzen: 'HZENPieces', vp1: 'VP1Pieces', vp2: 'VP2Pieces', total: 'totalPieces' } },
  pallets: { label: 'Pallets', keys: { hzen: 'HZENPallets', vp1: 'VP1Pallets', vp2: 'VP2Pallets', total: 'totalPallets' } },
  m2: { label: 'm²', keys: { hzen: 'HZENM2', vp1: 'VP1M2', vp2: 'VP2M2', total: 'totalM2' } },
}

interface TooltipPayloadEntry {
  value: number
  name: string
  color: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomProductionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null
  const values = payload.map((p: TooltipPayloadEntry) => p.value)
  const hasDuplicates = new Set(values).size < values.length
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-1.5 text-sm border-b pb-1.5">Dia {label}</p>
      {payload.map((entry: TooltipPayloadEntry, index: number) => {
        const isDuplicate = hasDuplicates && values.filter((v: number) => v === entry.value).length > 1
        return (
          <div key={index} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-gray-600">{entry.name}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {entry.value != null ? fmtMax(entry.value as number, 1) : '0'}
              {isDuplicate && ' *'}
            </span>
          </div>
        )
      })}
      {hasDuplicates && (
        <p className="text-[10px] text-gray-400 mt-1.5 pt-1 border-t">* valores iguais (sobreposição)</p>
      )}
    </div>
  )
}

export function ProductionDashClient({
  initialYear,
  initialMonth,
  initialProductionData,
  initialSummary,
  initialProductPieces,
  initialDowntimeData,
  initialParetoNV1,
}: ProductionDashClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [productionData, setProductionData] = useState(initialProductionData)
  const [summary, setSummary] = useState(initialSummary)
  const [productPieces, setProductPieces] = useState(initialProductPieces)
  const [downtimeData, setDowntimeData] = useState(initialDowntimeData)
  const [paretoNV1, setParetoNV1] = useState(initialParetoNV1)
  const [loading, setLoading] = useState(false)
  const [chartUnit, setChartUnit] = useState<ChartUnit>('cycles')

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)

    const [newProductionData, newSummary, newProductPieces, newDowntimeData, newParetoNV1] = await Promise.all([
      getMonthlyProductionData(newYear, newMonth),
      getMonthlySummary(newYear, newMonth),
      getMonthlyProductPiecesSummary(newYear, newMonth),
      getMonthlyDowntimeData(newYear, newMonth),
      getDowntimePareto(newYear, newMonth, 1),
    ])

    setProductionData(newProductionData)
    setSummary(newSummary)
    setProductPieces(newProductPieces)
    setDowntimeData(newDowntimeData)
    setParetoNV1(newParetoNV1)
    setLoading(false)
  }

  // Calcular totais por máquina (apenas dias com lançamento)
  const machineStats = ['HZEN', 'VP1', 'VP2'].map((machine) => {
    const machineData = summary.filter((s) => s.machineName === machine)
    // Dias com produção programada (turno > 0) E dados lançados.
    // Dias sem turno programado não contam (ex: fim de semana).
    // Dias com turno mas produção zero (ex: máquina quebrada) contam no denominador.
    const daysWithProduction = machineData.filter((s) => s.hasProduction && s.shiftMinutes > 0)
    const totalCycles = daysWithProduction.reduce((sum, s) => sum + s.productionCycles, 0)
    const totalDowntime = daysWithProduction.reduce((sum, s) => sum + s.downtimeMinutes, 0)
    const totalShift = daysWithProduction.reduce((sum, s) => sum + s.shiftMinutes, 0)
    const workDays = daysWithProduction.length

    return {
      machine,
      totalCycles,
      totalDowntime,
      totalShift,
      workDays,
      avgCyclesPerDay: workDays > 0 ? Math.round(totalCycles / workDays) : 0,
      availability: totalShift > 0 ? Math.round(((totalShift - totalDowntime) / totalShift) * 100) : 0,
    }
  })

  const totalCycles = machineStats.reduce((sum, s) => sum + s.totalCycles, 0)
  const totalPieces = (productPieces || []).reduce((sum, p) => sum + p.totalPieces, 0)
  const totalPallets = (productPieces || []).reduce((sum, p) => sum + p.totalPallets, 0)
  const totalM2 = (productPieces || []).reduce((sum, p) => sum + p.totalM2, 0)

  // Dias com produção programada (pelo menos uma máquina com turno > 0)
  const scheduledDates = new Set(
    summary.filter((s) => s.shiftMinutes > 0).map((s) => s.date)
  )

  // Formatar dados para gráfico — dias sem produção programada ficam com valores undefined
  // para que o Recharts não renderize dots nem linhas nesses pontos
  const chartData = productionData.map((d) => {
    const day = new Date(d.date + 'T12:00:00').getDate()
    if (!scheduledDates.has(d.date)) {
      return { date: d.date, day }
    }
    return { ...d, day }
  })

  const unitConfig = UNIT_CONFIG[chartUnit]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Produção</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Ciclos</div>
              <div className="text-3xl font-bold text-gray-900">{fmtInt(totalCycles)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Peças</div>
              <div className="text-3xl font-bold text-indigo-600">{fmtInt(totalPieces)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Pallets</div>
              <div className="text-3xl font-bold text-purple-600">{fmtMax(totalPallets, 1)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total m²</div>
              <div className="text-3xl font-bold text-teal-600">{fmtMax(totalM2, 1)}</div>
            </div>
            {machineStats.map((stat) => {
              const machineColor = stat.machine === 'VP1'
                ? 'border-l-green-500 text-green-600'
                : stat.machine === 'VP2'
                ? 'border-l-blue-500 text-blue-600'
                : 'border-l-orange-500 text-orange-600'
              return (
                <div key={stat.machine} className={`bg-white rounded-lg shadow p-4 border-l-4 ${machineColor.split(' ')[0]}`}>
                  <div className={`text-sm font-medium ${machineColor.split(' ')[1]}`}>{stat.machine}</div>
                  <div className="text-2xl font-bold text-gray-900">{fmtInt(stat.totalCycles)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Média: {stat.avgCyclesPerDay}/dia | Disp: {stat.availability}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Toggle de unidade + Gráfico de Linhas */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Produção Diária ({unitConfig.label})</h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(Object.keys(UNIT_CONFIG) as ChartUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setChartUnit(unit)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      chartUnit === unit
                        ? 'bg-white text-gray-900 shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {UNIT_CONFIG[unit].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip content={<CustomProductionTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey={unitConfig.keys.hzen} name="HZEN" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3, fill: '#ea580c' }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey={unitConfig.keys.vp1} name="VP1" stroke="#16a34a" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 3, fill: '#16a34a' }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey={unitConfig.keys.vp2} name="VP2" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Barras - Total por Dia */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Total Diário - {unitConfig.label} (Todas as Máquinas)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => `Dia ${value}`}
                    formatter={(value) => [value != null ? fmtMax(value as number, 1) : '0', unitConfig.label]}
                  />
                  <Bar dataKey={unitConfig.keys.total} fill="#2d3e7e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela de Resumo por Máquina */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <h2 className="text-lg font-semibold p-4 border-b">Resumo por Máquina</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Máquina</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ciclos</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Média/Dia</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paradas (min)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Disponibilidade</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {machineStats.map((stat) => {
                  const machineColor = stat.machine === 'VP1'
                    ? 'text-green-600'
                    : stat.machine === 'VP2'
                    ? 'text-blue-600'
                    : 'text-orange-600'
                  return (
                    <tr key={stat.machine}>
                      <td className={`px-6 py-4 whitespace-nowrap font-semibold ${machineColor}`}>{stat.machine}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(stat.totalCycles)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">{stat.avgCyclesPerDay} ciclos</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">{stat.totalDowntime}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={stat.availability >= 80 ? 'text-green-600' : stat.availability >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                          {stat.availability}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Resumo de Peças por Produto */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <h2 className="text-lg font-semibold p-4 border-b">Resumo por Produto</h2>
            {(!productPieces || productPieces.length === 0) ? (
              <div className="p-4 text-center text-gray-500">Nenhum produto registrado neste mês</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ciclos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peças</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pallets</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">m²</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Por Máquina</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productPieces.map((product) => (
                      <tr key={product.productId}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.productName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(product.totalCycles)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-indigo-600">
                          {fmtInt(product.totalPieces)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-purple-600">
                          {product.totalPallets > 0 ? fmtMax(product.totalPallets, 1) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-teal-600">
                          {product.totalM2 > 0 ? fmtMax(product.totalM2, 1) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {product.machineBreakdown.map((m) => {
                              const machineColor = m.machineName === 'VP1'
                                ? 'bg-green-100 text-green-700'
                                : m.machineName === 'VP2'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                              return (
                                <span
                                  key={m.machineName}
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs ${machineColor}`}
                                >
                                  {m.machineName}: {fmtInt(m.pieces)} pçs
                                </span>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Linha de total */}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {fmtInt(productPieces.reduce((sum, p) => sum + p.totalCycles, 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-indigo-600">
                        {fmtInt(totalPieces)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-purple-600">
                        {totalPallets > 0 ? fmtMax(totalPallets, 1) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-teal-600">
                        {totalM2 > 0 ? fmtMax(totalM2, 1) : '-'}
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* === SEÇÃO DE PARADAS === */}
          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Paradas</h2>

          {/* Cards de Resumo - Paradas */}
          {(() => {
            const totalDowntimeMinutes = downtimeData.reduce((sum, d) => sum + d.totalMinutes, 0)
            const totalDowntimeEvents = downtimeData.reduce((sum, d) => sum + d.count, 0)
            const nv1Grouped = paretoNV1.map((item) => ({
              name: item.reason,
              minutes: item.minutes,
            }))

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Total Paradas</div>
                    <div className="text-3xl font-bold text-[#dc2626]">{formatMinutes(totalDowntimeMinutes)}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Quantidade de Eventos</div>
                    <div className="text-3xl font-bold text-gray-900">{totalDowntimeEvents}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Média por Evento</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {totalDowntimeEvents > 0 ? formatMinutes(Math.round(totalDowntimeMinutes / totalDowntimeEvents)) : '0'}
                    </div>
                  </div>
                </div>

                {/* Cards de Tempo Médio Diário de Paradas por Máquina */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {machineStats.map((stat) => {
                    const avgDowntime = stat.workDays > 0 ? Math.round(stat.totalDowntime / stat.workDays) : 0
                    const colorConfig = stat.machine === 'VP1'
                      ? 'border-l-green-500 text-green-600'
                      : stat.machine === 'VP2'
                      ? 'border-l-blue-500 text-blue-600'
                      : 'border-l-orange-500 text-orange-600'
                    return (
                      <div key={stat.machine} className={`bg-white rounded-lg shadow p-4 border-l-4 ${colorConfig.split(' ')[0]}`}>
                        <div className={`text-sm font-medium ${colorConfig.split(' ')[1]}`}>
                          Média Diária - {stat.machine}
                        </div>
                        <div className="text-3xl font-bold text-gray-900">{formatMinutes(avgDowntime)}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {stat.workDays} dias | Total: {formatMinutes(stat.totalDowntime)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Gráfico de Barras por NV1 */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Paradas por Categoria (NV1)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nv1Grouped} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip formatter={(value) => [formatMinutes(value as number), 'Tempo']} />
                        <Bar dataKey="minutes" fill="#f87171" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tabela Detalhada de Paradas */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <h3 className="text-lg font-semibold p-4 border-b">Detalhamento por Motivo</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NV1</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NV2</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NV3</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tempo</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {downtimeData.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{item.reasonNV1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{item.reasonNV2}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.reasonNV3}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[#dc2626] font-medium">
                              {formatMinutes(item.totalMinutes)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{item.count}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                              {totalDowntimeMinutes > 0 ? fmtDec((item.totalMinutes / totalDowntimeMinutes) * 100, 1) : 0}%
                            </td>
                          </tr>
                        ))}
                        {downtimeData.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                              Nenhuma parada registrada neste mês
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
