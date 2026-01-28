'use client'

import { useState } from 'react'
import { saveMachineShifts, resetMachineShifts } from '@/app/actions/shifts'
import { DAY_NAMES, DEFAULT_SHIFTS } from '@/lib/shift'

interface ShiftData {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  breakMinutes: number
  isCustom: boolean
}

interface MachineWithShifts {
  id: string
  name: string
  shifts: ShiftData[]
}

interface Props {
  machines: MachineWithShifts[]
}

function calculateMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  if (startTime === endTime) return 0
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  return Math.max(0, totalMinutes - breakMinutes)
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}min`
}

export function TurnosClient({ machines: initialMachines }: Props) {
  const [machines, setMachines] = useState(initialMachines)
  const [editingMachine, setEditingMachine] = useState<string | null>(null)
  const [editedShifts, setEditedShifts] = useState<ShiftData[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const startEditing = (machine: MachineWithShifts) => {
    setEditingMachine(machine.id)
    setEditedShifts(machine.shifts.map(s => ({ ...s })))
    setMessage(null)
  }

  const cancelEditing = () => {
    setEditingMachine(null)
    setEditedShifts([])
  }

  const updateShift = (dayOfWeek: number, field: keyof ShiftData, value: string | number) => {
    setEditedShifts(shifts =>
      shifts.map(s =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value, isCustom: true } : s
      )
    )
  }

  const saveShifts = async () => {
    if (!editingMachine) return

    setSaving(true)
    setMessage(null)

    const result = await saveMachineShifts(
      editingMachine,
      editedShifts.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
      }))
    )

    if (result.success) {
      setMachines(machines =>
        machines.map(m =>
          m.id === editingMachine
            ? { ...m, shifts: editedShifts.map(s => ({ ...s, isCustom: true })) }
            : m
        )
      )
      setMessage({ type: 'success', text: 'Turnos salvos com sucesso!' })
      setEditingMachine(null)
      setEditedShifts([])
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao salvar' })
    }

    setSaving(false)
  }

  const resetToDefault = async (machineId: string) => {
    if (!confirm('Deseja resetar os turnos desta máquina para os valores padrão?')) {
      return
    }

    setSaving(true)
    setMessage(null)

    const result = await resetMachineShifts(machineId)

    if (result.success) {
      setMachines(machines =>
        machines.map(m =>
          m.id === machineId
            ? {
                ...m,
                shifts: Array.from({ length: 7 }, (_, day) => ({
                  dayOfWeek: day,
                  ...DEFAULT_SHIFTS[day],
                  isCustom: false,
                })),
              }
            : m
        )
      )
      setMessage({ type: 'success', text: 'Turnos resetados para o padrão!' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao resetar' })
    }

    setSaving(false)
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {machines.map((machine) => {
        const isEditing = editingMachine === machine.id
        const shifts = isEditing ? editedShifts : machine.shifts
        const hasCustomShifts = machine.shifts.some(s => s.isCustom)

        return (
          <div
            key={machine.id}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{machine.name}</h2>
                {hasCustomShifts && !isEditing && (
                  <span className="text-xs bg-blue-500 px-2 py-1 rounded mt-1 inline-block">
                    Turno personalizado
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => startEditing(machine)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                    >
                      Editar
                    </button>
                    {hasCustomShifts && (
                      <button
                        onClick={() => resetToDefault(machine.id)}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Resetar
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveShifts}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Dia
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Início
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Fim
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Pausas (min)
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Minutos Úteis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shifts.map((shift) => {
                    const minutes = calculateMinutes(
                      shift.startTime,
                      shift.endTime,
                      shift.breakMinutes
                    )
                    const isWeekend = shift.dayOfWeek === 0 || shift.dayOfWeek === 6

                    return (
                      <tr
                        key={shift.dayOfWeek}
                        className={isWeekend ? 'bg-gray-50' : ''}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {DAY_NAMES[shift.dayOfWeek]}
                          {shift.isCustom && !isEditing && (
                            <span className="ml-2 text-xs text-blue-600">*</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) =>
                                updateShift(shift.dayOfWeek, 'startTime', e.target.value)
                              }
                              className="border rounded px-2 py-1 text-sm w-24"
                            />
                          ) : (
                            <span className="text-sm text-gray-700">
                              {shift.startTime}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) =>
                                updateShift(shift.dayOfWeek, 'endTime', e.target.value)
                              }
                              className="border rounded px-2 py-1 text-sm w-24"
                            />
                          ) : (
                            <span className="text-sm text-gray-700">
                              {shift.endTime}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={shift.breakMinutes}
                              onChange={(e) =>
                                updateShift(
                                  shift.dayOfWeek,
                                  'breakMinutes',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              min={0}
                              className="border rounded px-2 py-1 text-sm w-20 text-center"
                            />
                          ) : (
                            <span className="text-sm text-gray-700">
                              {shift.breakMinutes}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-sm font-medium ${
                              minutes > 0 ? 'text-green-600' : 'text-gray-400'
                            }`}
                          >
                            {formatMinutes(minutes)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Valores Padrão</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>Segunda a Quinta: 07:00 - 17:00 (525 min úteis)</li>
          <li>Sexta: 07:00 - 16:00 (465 min úteis)</li>
          <li>Sábado e Domingo: Não trabalha</li>
          <li>Pausas: 75 min (60 almoço + 15 merenda)</li>
        </ul>
      </div>
    </div>
  )
}
