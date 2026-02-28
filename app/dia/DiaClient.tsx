'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import type { Machine, Product, ProductionDay, ProductionItem, DowntimeEvent, DowntimeReason, ShiftOverride } from '@/app/generated/prisma/client'
import { getProductionDay } from '@/app/actions/production'
import { getMachineShiftForDay, type ShiftData } from '@/app/actions/shifts'
import { getShiftOverride, saveShiftOverride, deleteShiftOverride } from '@/app/actions/shift'
import { DatePicker } from '@/app/components/DatePicker'
import { ProductionForm } from '@/app/components/ProductionForm'
import { DowntimeForm } from '@/app/components/DowntimeForm'
import { formatMinutes, getDayOfWeekName } from '@/lib/shift'
import { fmtInt, fmtMax } from '@/lib/format'

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

interface EffectiveShift extends ShiftData {
  isOverride: boolean
}

function calculateShiftMinutes(shift: ShiftData): number {
  if (shift.startTime === shift.endTime) return 0
  const [startHour, startMin] = shift.startTime.split(':').map(Number)
  const [endHour, endMin] = shift.endTime.split(':').map(Number)
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  return Math.max(0, totalMinutes - shift.breakMinutes)
}

export function DiaClient({ machines, products }: DiaClientProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [productionData, setProductionData] = useState<Record<string, ProductionDayWithRelations | null>>({})
  const [machineShifts, setMachineShifts] = useState<Record<string, EffectiveShift>>({})
  const [, setShiftOverrides] = useState<Record<string, ShiftOverride | null>>({})
  const [loading, setLoading] = useState(true)
  const [editingShift, setEditingShift] = useState<string | null>(null)
  const [shiftForm, setShiftForm] = useState({ dayOfWeek: 0, startTime: '', endTime: '', breakMinutes: 0 })
  const [savingShift, setSavingShift] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const data: Record<string, ProductionDayWithRelations | null> = {}
    const shifts: Record<string, EffectiveShift> = {}
    const overrides: Record<string, ShiftOverride | null> = {}

    for (const machine of machines) {
      const [pd, baseShift, override] = await Promise.all([
        getProductionDay(machine.id, selectedDate),
        getMachineShiftForDay(machine.id, selectedDate.getDay()),
        getShiftOverride(machine.id, selectedDate),
      ])
      data[machine.id] = pd as ProductionDayWithRelations | null
      overrides[machine.id] = override

      // Usar override se existir, senão usar turno base
      if (override) {
        shifts[machine.id] = {
          dayOfWeek: selectedDate.getDay(),
          startTime: override.startTime,
          endTime: override.endTime,
          breakMinutes: override.breakMinutes,
          isOverride: true,
        }
      } else {
        shifts[machine.id] = {
          ...baseShift,
          isOverride: false,
        }
      }
    }

    startTransition(() => {
      setProductionData(data)
      setMachineShifts(shifts)
      setShiftOverrides(overrides)
      setLoading(false)
    })
  }, [machines, selectedDate])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const dayOfWeek = selectedDate.getDay()
  // Verificar se alguma máquina tem turno disponível
  const anyMachineHasShift = Object.values(machineShifts).some(
    (shift) => calculateShiftMinutes(shift) > 0
  )

  const handleEditShift = (machineId: string) => {
    const shift = machineShifts[machineId]
    setShiftForm({
      dayOfWeek: selectedDate.getDay(),
      startTime: shift?.startTime || '07:00',
      endTime: shift?.endTime || '17:00',
      breakMinutes: shift?.breakMinutes || 75,
    })
    setEditingShift(machineId)
  }

  const handleSaveShift = async (machineId: string) => {
    setSavingShift(true)
    await saveShiftOverride({
      machineId,
      date: selectedDate,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: shiftForm.breakMinutes,
    })
    setEditingShift(null)
    await loadData()
    setSavingShift(false)
  }

  const handleRemoveOverride = async (machineId: string) => {
    setSavingShift(true)
    await deleteShiftOverride(machineId, selectedDate)
    setEditingShift(null)
    await loadData()
    setSavingShift(false)
  }

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
      ) : (
        <>
        {!anyMachineHasShift && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-center">
            <div className="text-amber-700 font-medium">{getDayOfWeekName(dayOfWeek)} - Sem turno programado</div>
            <div className="text-amber-600 text-sm">Clique em &quot;Adicionar turno&quot; em uma máquina para registrar produção</div>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6">
          {machines.map((machine) => {
            const pd = productionData[machine.id]
            const shift = machineShifts[machine.id]
            const shiftMinutes = shift ? calculateShiftMinutes(shift) : 0
            const totalCycles = pd?.productionItems.reduce((sum, item) => sum + item.cycles, 0) || 0
            const totalDowntime = pd?.downtimeEvents.reduce((sum, e) => sum + e.durationMinutes, 0) || 0

            const isEditing = editingShift === machine.id

            // Se a máquina não tem turno neste dia, mostrar mensagem com opção de adicionar
            if (shiftMinutes === 0 && !isEditing) {
              return (
                <div key={machine.id} className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                  <div className="text-lg font-bold text-gray-400">{machine.name}</div>
                  <div className="text-sm text-gray-400 mt-2">Sem turno programado</div>
                  <button
                    onClick={() => handleEditShift(machine.id)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Adicionar turno para este dia
                  </button>
                </div>
              )
            }

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
                  <div className="flex justify-between items-start">
                    <div className={`text-lg font-bold ${
                      machine.name === 'VP1'
                        ? 'text-green-800'
                        : machine.name === 'VP2'
                        ? 'text-blue-800'
                        : 'text-orange-800'
                    }`}>{machine.name}</div>
                    {shift && !isEditing && (
                      <button
                        onClick={() => handleEditShift(machine.id)}
                        className="text-xs text-right group cursor-pointer hover:bg-white/50 rounded p-1 -m-1 transition-colors"
                        title="Clique para ajustar turno deste dia"
                      >
                        <div className="flex items-center gap-1 justify-end text-gray-600 group-hover:text-blue-600">
                          {shift.startTime} - {shift.endTime}
                          {shift.isOverride && (
                            <span className="text-orange-500" title="Turno ajustado para este dia">*</span>
                          )}
                          <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                        <div className="font-medium text-gray-600 group-hover:text-blue-600">{formatMinutes(shiftMinutes)} úteis</div>
                      </button>
                    )}
                  </div>

                  {/* Formulário de edição de turno */}
                  {isEditing && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Ajustar turno para {formatDateDisplay(selectedDate).split(',')[0]}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Início</label>
                          <input
                            type="time"
                            value={shiftForm.startTime}
                            onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fim</label>
                          <input
                            type="time"
                            value={shiftForm.endTime}
                            onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pausas</label>
                          <input
                            type="number"
                            value={shiftForm.breakMinutes}
                            onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: parseInt(e.target.value) || 0 })}
                            min={0}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Minutos úteis: <span className="font-medium">
                          {formatMinutes(calculateShiftMinutes(shiftForm))}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleSaveShift(machine.id)}
                          disabled={savingShift}
                          className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingShift ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setEditingShift(null)}
                          disabled={savingShift}
                          className="px-3 bg-gray-200 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        {shift?.isOverride && (
                          <button
                            onClick={() => handleRemoveOverride(machine.id)}
                            disabled={savingShift}
                            className="px-3 bg-red-100 text-red-700 text-xs py-1.5 rounded hover:bg-red-200 disabled:opacity-50"
                            title="Remover ajuste e usar turno padrão"
                          >
                            Resetar
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <>
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
                      {/* Cadeia de conversão: Peças → Pallets → m² */}
                      {pd && pd.productionItems.some(item => item.pieces) && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="bg-white rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-indigo-600">
                              {fmtInt(pd.productionItems.reduce((sum, item) => sum + (item.pieces || 0), 0))}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Peças</div>
                          </div>
                          <div className="bg-white rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-purple-600">
                              {fmtMax(pd.productionItems.reduce((sum, item) => sum + (item.pallets || 0), 0), 1)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Pallets</div>
                          </div>
                          <div className="bg-white rounded-md p-2 text-center">
                            <div className="text-lg font-bold text-teal-600">
                              {fmtMax(pd.productionItems.reduce((sum, item) => sum + (item.areaM2 || 0), 0), 1)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">m²</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                    machineId={machine.id}
                    existingEvents={pd.downtimeEvents}
                    onSaved={loadData}
                  />
                )}
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
