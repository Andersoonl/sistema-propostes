'use client'

import { useState } from 'react'
import { fmtDec } from '@/lib/format'
import { MonthPicker } from '@/app/components/DatePicker'
import { getMonthlyDowntimeData, getDowntimePareto } from '@/app/actions/dashboard'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts'
import { formatMinutes } from '@/lib/shift'

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

interface DowntimeDashClientProps {
  initialYear: number
  initialMonth: number
  initialDowntimeData: MonthlyDowntimeData[]
  initialParetoNV1: ParetoData[]
  initialParetoNV2: ParetoData[]
  initialParetoNV3: ParetoData[]
}

export function DowntimeDashClient({
  initialYear,
  initialMonth,
  initialDowntimeData,
  initialParetoNV1,
  initialParetoNV2,
  initialParetoNV3,
}: DowntimeDashClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [downtimeData, setDowntimeData] = useState(initialDowntimeData)
  const [paretoNV1, setParetoNV1] = useState(initialParetoNV1)
  const [paretoNV2, setParetoNV2] = useState(initialParetoNV2)
  const [paretoNV3, setParetoNV3] = useState(initialParetoNV3)
  const [loading, setLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1)

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)

    const [newDowntimeData, newParetoNV1, newParetoNV2, newParetoNV3] = await Promise.all([
      getMonthlyDowntimeData(newYear, newMonth),
      getDowntimePareto(newYear, newMonth, 1),
      getDowntimePareto(newYear, newMonth, 2),
      getDowntimePareto(newYear, newMonth, 3),
    ])

    setDowntimeData(newDowntimeData)
    setParetoNV1(newParetoNV1)
    setParetoNV2(newParetoNV2)
    setParetoNV3(newParetoNV3)
    setLoading(false)
  }

  const totalMinutes = downtimeData.reduce((sum, d) => sum + d.totalMinutes, 0)
  const totalEvents = downtimeData.reduce((sum, d) => sum + d.count, 0)

  // Selecionar dados do Pareto baseado no nível
  const paretoData = selectedLevel === 1 ? paretoNV1 : selectedLevel === 2 ? paretoNV2 : paretoNV3

  // Agrupar por NV1 para o gráfico de barras
  const nv1Grouped = paretoNV1.map((item) => ({
    name: item.reason,
    minutes: item.minutes,
  }))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Paradas</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Paradas</div>
              <div className="text-3xl font-bold text-[#dc2626]">{formatMinutes(totalMinutes)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Quantidade de Eventos</div>
              <div className="text-3xl font-bold text-gray-900">{totalEvents}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Média por Evento</div>
              <div className="text-3xl font-bold text-gray-900">
                {totalEvents > 0 ? formatMinutes(Math.round(totalMinutes / totalEvents)) : '0'}
              </div>
            </div>
          </div>

          {/* Gráfico de Barras por NV1 */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Paradas por Categoria (NV1)</h2>
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

          {/* Gráfico de Pareto */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Análise de Pareto</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedLevel(1)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedLevel === 1 ? 'bg-[#2d3e7e] text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  NV1
                </button>
                <button
                  onClick={() => setSelectedLevel(2)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedLevel === 2 ? 'bg-[#2d3e7e] text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  NV2
                </button>
                <button
                  onClick={() => setSelectedLevel(3)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedLevel === 3 ? 'bg-[#2d3e7e] text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  NV3
                </button>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="reason"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value, name) => {
                      const v = value as number
                      if (name === 'minutes') return [formatMinutes(v), 'Tempo']
                      return [`${v}%`, name === 'cumulativePercentage' ? 'Acumulado' : 'Percentual']
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="minutes" fill="#f87171" name="Tempo (min)" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativePercentage"
                    stroke="#2d3e7e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="% Acumulado"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-lg font-semibold p-4 border-b">Detalhamento por Motivo</h2>
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
                        {totalMinutes > 0 ? fmtDec((item.totalMinutes / totalMinutes) * 100, 1) : 0}%
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
      )}
    </div>
  )
}
