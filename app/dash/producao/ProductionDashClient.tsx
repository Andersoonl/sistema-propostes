'use client'

import { useState } from 'react'
import { MonthPicker } from '@/app/components/DatePicker'
import { getMonthlyProductionData, getMonthlySummary } from '@/app/actions/dashboard'
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

interface MonthlyProductionData {
  date: string
  VP1: number
  VP2: number
  HZEN: number
  total: number
}

interface DailySummary {
  date: string
  dayOfWeek: number
  machineId: string
  machineName: string
  shiftMinutes: number
  productionCycles: number
  downtimeMinutes: number
  availableMinutes: number
}

interface ProductionDashClientProps {
  initialYear: number
  initialMonth: number
  initialProductionData: MonthlyProductionData[]
  initialSummary: DailySummary[]
}

export function ProductionDashClient({
  initialYear,
  initialMonth,
  initialProductionData,
  initialSummary,
}: ProductionDashClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [productionData, setProductionData] = useState(initialProductionData)
  const [summary, setSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(false)

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)

    const [newProductionData, newSummary] = await Promise.all([
      getMonthlyProductionData(newYear, newMonth),
      getMonthlySummary(newYear, newMonth),
    ])

    setProductionData(newProductionData)
    setSummary(newSummary)
    setLoading(false)
  }

  // Calcular totais por máquina
  const machineStats = ['VP1', 'VP2', 'HZEN'].map((machine) => {
    const machineData = summary.filter((s) => s.machineName === machine)
    const totalCycles = machineData.reduce((sum, s) => sum + s.productionCycles, 0)
    const totalDowntime = machineData.reduce((sum, s) => sum + s.downtimeMinutes, 0)
    const totalShift = machineData.reduce((sum, s) => sum + s.shiftMinutes, 0)
    const workDays = machineData.filter((s) => s.shiftMinutes > 0).length

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

  // Formatar dados para gráfico de barras diário
  const chartData = productionData
    .filter((d) => d.total > 0 || productionData.some((p) => p.date === d.date))
    .map((d) => ({
      ...d,
      day: new Date(d.date + 'T12:00:00').getDate(),
    }))

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Ciclos</div>
              <div className="text-3xl font-bold text-gray-900">{totalCycles.toLocaleString()}</div>
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
                  <div className="text-2xl font-bold text-gray-900">{stat.totalCycles.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Média: {stat.avgCyclesPerDay}/dia | Disp: {stat.availability}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gráfico de Linhas - Produção Diária */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Produção Diária (Ciclos)</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => `Dia ${value}`}
                    formatter={(value) => [(value as number)?.toLocaleString() ?? '0', '']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="VP1" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="VP2" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="HZEN" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Barras - Total por Dia */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Total Diário (Todas as Máquinas)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => `Dia ${value}`}
                    formatter={(value) => [(value as number)?.toLocaleString() ?? '0', 'Ciclos']}
                  />
                  <Bar dataKey="total" fill="#2d3e7e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela de Resumo */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">{stat.totalCycles.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">{stat.avgCyclesPerDay}</td>
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
        </>
      )}
    </div>
  )
}
