'use client'

import { useState } from 'react'
import { MonthPicker } from '@/app/components/DatePicker'
import {
  getCashFlowData,
  type CashFlowData,
  type CashFlowMovement,
  type CashFlowDayBalance,
} from '@/app/actions/cash-flow'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { fmtMoney } from '@/lib/format'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

interface Props {
  initialYear: number
  initialMonth: number
  initialData: CashFlowData
}

export function FluxoCaixaClient({ initialYear, initialMonth, initialData }: Props) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [data, setData] = useState<CashFlowData>(initialData)
  const [loading, setLoading] = useState(false)

  const handleMonthChange = async (y: number, m: number) => {
    setYear(y)
    setMonth(m)
    setLoading(true)
    try {
      const newData = await getCashFlowData(y, m)
      setData(newData)
    } finally {
      setLoading(false)
    }
  }

  const { kpis, movements, dailyBalance } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Fluxo de Caixa</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      {loading && (
        <div className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-md">Carregando...</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Entradas</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{fmtMoney(kpis.totalIn)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Saídas</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{fmtMoney(kpis.totalOut)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Saldo Período</div>
          <div className={`text-2xl font-bold mt-1 ${kpis.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {fmtMoney(kpis.balance)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Pend. Receber</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{fmtMoney(kpis.pendingReceivable)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Pend. Pagar</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{fmtMoney(kpis.pendingPayable)}</div>
        </div>
      </div>

      {/* Gráfico — Evolução do Saldo */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Evolução do Saldo
        </h2>
        {dailyBalance.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sem movimentações no período</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyBalance}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3bbfb5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3bbfb5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => String(d)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => fmtMoney(v)}
                />
                <Tooltip
                  formatter={(value) => [fmtMoney(Number(value)), 'Saldo']}
                  labelFormatter={(day) => `Dia ${day}`}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#3bbfb5"
                  strokeWidth={2}
                  fill="url(#colorBalance)"
                  name="Saldo"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela — Movimentações */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Movimentações do Período
          </h2>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sem movimentações no período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referência</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Acum.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movements.map((m, i) => (
                  <MovementRow key={i} movement={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MovementRow({ movement }: { movement: CashFlowMovement }) {
  const isIn = movement.type === 'IN'
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-sm">
        {formatDate(movement.date)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isIn ? 'Entrada' : 'Saída'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-900 text-sm">
        {movement.description}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[#2d3e7e] font-medium text-sm">
        {movement.reference}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap text-right font-medium text-sm ${
        isIn ? 'text-green-600' : 'text-red-600'
      }`}>
        {isIn ? '+' : '-'} {fmtMoney(movement.amount)}
      </td>
      <td className={`px-4 py-3 whitespace-nowrap text-right font-medium text-sm ${
        movement.runningBalance >= 0 ? 'text-blue-600' : 'text-red-600'
      }`}>
        {fmtMoney(movement.runningBalance)}
      </td>
    </tr>
  )
}
