'use client'

import { useState } from 'react'
import { fmtInt, fmtMax, fmtDec, fmtMoney } from '@/lib/format'
import { MonthPicker } from '@/app/components/DatePicker'
import { getProductionChainSummary } from '@/app/actions/dashboard'

interface MaterialConsumption {
  ingredientName: string
  unit: string
  totalConsumed: number
  totalCost: number
}

interface MachineBreakdown {
  machineName: string
  cycles: number
  pieces: number
  pallets: number
  m2: number
}

interface ProductionChainSummary {
  materialConsumption: MaterialConsumption[]
  totalMaterialCost: number
  totalBatches: number
  totalCycles: number
  totalPieces: number
  totalPallets: number
  totalM2: number
  byMachine: MachineBreakdown[]
  palletizedPieces: number
  palletizedPallets: number
  palletizedM2: number
  lossPieces: number
  lossPct: number
  stockAvailablePieces: number
  stockCuringPieces: number
  stockLoosePieces: number
  stockPieces: number
  stockPallets: number
  stockM2: number
}

interface CadeiaClientProps {
  initialYear: number
  initialMonth: number
  initialData: ProductionChainSummary
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-gray-300">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </div>
  )
}

export function CadeiaClient({ initialYear, initialMonth, initialData }: CadeiaClientProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)
    const newData = await getProductionChainSummary(newYear, newMonth)
    setData(newData)
    setLoading(false)
  }

  const lossColor = data.lossPct < 3 ? 'text-green-600' : data.lossPct < 5 ? 'text-amber-600' : 'text-red-600'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Cadeia Produtiva</h1>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : (
        <>
          {/* Fluxo Visual */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Fluxo de Produção do Mês</h2>
            <div className="grid grid-cols-[2fr_auto_1fr_auto_1fr_auto_1fr_auto_1.5fr_auto_2fr] gap-2 items-center">
              {/* MP */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">Matéria Prima</div>
                <div className="text-xl font-bold text-amber-700">
                  {fmtMoney(data.totalMaterialCost, 0)}
                </div>
                <div className="text-xs text-amber-500 mt-1">
                  {data.materialConsumption.length} materiais
                </div>
              </div>

              <FlowArrow />

              {/* Traços */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Traços</div>
                <div className="text-xl font-bold text-blue-700">{fmtInt(data.totalBatches)}</div>
              </div>

              <FlowArrow />

              {/* Ciclos */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Ciclos</div>
                <div className="text-xl font-bold text-indigo-700">{fmtInt(data.totalCycles)}</div>
              </div>

              <FlowArrow />

              {/* Peças */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">Peças</div>
                <div className="text-xl font-bold text-purple-700">{fmtInt(data.totalPieces)}</div>
              </div>

              <FlowArrow />

              {/* Paletização */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">Paletização</div>
                <div className="flex justify-around">
                  <div>
                    <div className="text-lg font-bold text-orange-700">{fmtInt(data.palletizedPallets)}</div>
                    <div className="text-xs text-orange-500">pallets</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${lossColor}`}>{fmtDec(data.lossPct, 1)}%</div>
                    <div className="text-xs text-orange-500">perda</div>
                  </div>
                </div>
              </div>

              <FlowArrow />

              {/* Estoque */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
                <div className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-1">Estoque</div>
                <div className="flex justify-around">
                  <div>
                    <div className="text-lg font-bold text-teal-700">{fmtInt(data.stockPallets)}</div>
                    <div className="text-xs text-teal-500">pallets</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-teal-700">{fmtInt(data.stockM2)}</div>
                    <div className="text-xs text-teal-500">m²</div>
                  </div>
                </div>
                {(data.stockCuringPieces > 0 || data.stockLoosePieces > 0) && (
                  <div className="mt-2 flex justify-around text-xs">
                    {data.stockCuringPieces > 0 && (
                      <span className="text-amber-600">{fmtInt(data.stockCuringPieces)} em cura</span>
                    )}
                    {data.stockLoosePieces > 0 && (
                      <span className="text-purple-600">{fmtInt(data.stockLoosePieces)} soltas</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Custo MP Total</div>
              <div className="text-2xl font-bold text-amber-600">
                {fmtMoney(data.totalMaterialCost)}
              </div>
              {data.totalPieces > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  {fmtMoney(data.totalMaterialCost / data.totalPieces, 4)}/peça
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Produção do Mês</div>
              <div className="text-2xl font-bold text-indigo-600">{fmtInt(data.totalCycles)} ciclos</div>
              <div className="text-xs text-gray-400 mt-1">{fmtInt(data.totalBatches)} traços</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Peças Produzidas</div>
              <div className="text-2xl font-bold text-purple-600">{fmtInt(data.totalPieces)}</div>
              <div className="text-xs text-gray-400 mt-1">{fmtInt(data.totalPallets)} pallets | {fmtInt(data.totalM2)} m²</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Paletização</div>
              <div className="text-2xl font-bold text-orange-600">{fmtInt(data.palletizedPallets)} pallets</div>
              <div className="text-xs text-gray-400 mt-1">
                Perda: <span className={lossColor}>{fmtInt(data.lossPieces)} pçs ({fmtDec(data.lossPct, 1)}%)</span>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Estoque PA Atual</div>
              <div className="text-2xl font-bold text-teal-600">{fmtInt(data.stockAvailablePieces)} pçs</div>
              <div className="text-xs text-gray-400 mt-1">{fmtInt(data.stockPallets)} pallets | {fmtInt(data.stockM2)} m²</div>
            </div>
          </div>

          {/* Produção por Máquina */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <h2 className="text-lg font-semibold p-4 border-b">Produção por Máquina</h2>
            {data.byMachine.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Nenhuma produção registrada neste mês</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Máquina</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ciclos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peças</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pallets</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">m²</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.byMachine.map((machine) => {
                    const machineColor = machine.machineName === 'VP1'
                      ? 'text-green-600'
                      : machine.machineName === 'VP2'
                      ? 'text-blue-600'
                      : 'text-orange-600'
                    return (
                      <tr key={machine.machineName}>
                        <td className={`px-6 py-4 whitespace-nowrap font-semibold ${machineColor}`}>{machine.machineName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(machine.cycles)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(machine.pieces)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(machine.pallets)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(machine.m2)}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">TOTAL</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(data.totalCycles)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(data.totalPieces)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(data.totalPallets)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">{fmtInt(data.totalM2)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Consumo de Matéria Prima */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-lg font-semibold p-4 border-b">Consumo de Matéria Prima do Mês</h2>
            {data.materialConsumption.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Nenhum consumo registrado neste mês</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Consumido</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% do Custo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.materialConsumption.map((mat) => (
                    <tr key={mat.ingredientName}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{mat.ingredientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{mat.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {fmtMax(mat.totalConsumed, 2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">
                        {fmtMoney(mat.totalCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">
                        {data.totalMaterialCost > 0
                          ? fmtDec((mat.totalCost / data.totalMaterialCost) * 100, 1) + '%'
                          : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900" colSpan={3}>TOTAL</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {fmtMoney(data.totalMaterialCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
