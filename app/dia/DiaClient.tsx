'use client'

import { useState, useEffect } from 'react'
import type { Machine, Product, ProductionDay, ProductionItem, DowntimeEvent, DowntimeReason } from '@/app/generated/prisma/client'
import { getProductionDay } from '@/app/actions/production'
import { DatePicker } from '@/app/components/DatePicker'
import { ProductionForm } from '@/app/components/ProductionForm'
import { DowntimeForm } from '@/app/components/DowntimeForm'
import { getShiftConfig, getShiftMinutes, formatMinutes, getDayOfWeekName } from '@/lib/shift'

interface DiaClientProps {
  machines: Machine[]
  products: Product[]
}

type ProductionDayWithRelations = ProductionDay & {
  machine: Machine
  productionItems: (ProductionItem & { product: Product })[]
  downtimeEvents: (DowntimeEvent & {
    reason: DowntimeReason & {
      parent?: DowntimeReason & { parent?: DowntimeReason } | null
    }
  })[]
}

export function DiaClient({ machines, products }: DiaClientProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [productionData, setProductionData] = useState<Record<string, ProductionDayWithRelations | null>>({})
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const data: Record<string, ProductionDayWithRelations | null> = {}

    for (const machine of machines) {
      const pd = await getProductionDay(machine.id, selectedDate)
      data[machine.id] = pd as ProductionDayWithRelations | null
    }

    setProductionData(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const dayOfWeek = selectedDate.getDay()
  const shiftConfig = getShiftConfig(selectedDate)
  const shiftMinutes = getShiftMinutes(selectedDate)

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Lançamento de Produção</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
            <div className="flex-1">
              <div className="text-lg font-medium text-gray-900 capitalize">
                {formatDateDisplay(selectedDate)}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Turno: {shiftConfig.startTime} - {shiftConfig.endTime}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Disponível: <span className="font-medium text-[#2d3e7e]">{formatMinutes(shiftMinutes)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Carregando...
          </div>
        </div>
      ) : shiftMinutes === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <div className="text-lg font-medium text-gray-600">{getDayOfWeekName(dayOfWeek)}</div>
          <div className="text-gray-500">Sem turno programado</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {machines.map((machine) => {
            const pd = productionData[machine.id]
            const totalCycles = pd?.productionItems.reduce((sum, item) => sum + item.cycles, 0) || 0
            const totalDowntime = pd?.downtimeEvents.reduce((sum, e) => sum + e.durationMinutes, 0) || 0

            return (
              <div key={machine.id} className="space-y-4">
                {/* Resumo */}
                <div className={`rounded-lg p-4 border ${
                  machine.name === 'VP1'
                    ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200'
                    : machine.name === 'VP2'
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
                    : 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200'
                }`}>
                  <div className={`text-lg font-bold ${
                    machine.name === 'VP1'
                      ? 'text-green-800'
                      : machine.name === 'VP2'
                      ? 'text-blue-800'
                      : 'text-orange-800'
                  }`}>{machine.name}</div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="bg-white rounded-md p-2 text-center">
                      <div className={`text-2xl font-bold ${
                        machine.name === 'VP1'
                          ? 'text-green-600'
                          : machine.name === 'VP2'
                          ? 'text-blue-600'
                          : 'text-orange-600'
                      }`}>{totalCycles}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Ciclos</div>
                    </div>
                    <div className="bg-white rounded-md p-2 text-center">
                      <div className="text-2xl font-bold text-gray-600">{totalDowntime}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Min Paradas</div>
                    </div>
                  </div>
                </div>

                {/* Formulário de Produção */}
                <ProductionForm
                  machine={machine}
                  products={products}
                  date={selectedDate}
                  existingData={pd || undefined}
                  onSaved={loadData}
                />

                {/* Formulário de Paradas (só aparece se tiver ProductionDay) */}
                {pd && (
                  <DowntimeForm
                    productionDayId={pd.id}
                    existingEvents={pd.downtimeEvents}
                    onSaved={loadData}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
