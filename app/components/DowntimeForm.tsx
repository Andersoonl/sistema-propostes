'use client'

import { useState, useEffect } from 'react'
import type { DowntimeReason, DowntimeEvent } from '@/app/generated/prisma/client'
import { saveDowntimeEvent, deleteDowntimeEvent } from '@/app/actions/production'
import { createReason, getReasonHierarchy } from '@/app/actions/reasons'

type ReasonWithChildren = DowntimeReason & {
  children: (DowntimeReason & {
    children: DowntimeReason[]
  })[]
}

interface DowntimeFormProps {
  productionDayId: string
  machineId: string
  existingEvents: (DowntimeEvent & {
    reason: DowntimeReason & {
      parent?: DowntimeReason & {
        parent?: DowntimeReason
      } | null
    }
  })[]
  onSaved?: () => void
}

export function DowntimeForm({ productionDayId, machineId, existingEvents, onSaved }: DowntimeFormProps) {
  const [hierarchy, setHierarchy] = useState<ReasonWithChildren[]>([])
  const [selectedNV1, setSelectedNV1] = useState('')
  const [selectedNV2, setSelectedNV2] = useState('')
  const [selectedNV3, setSelectedNV3] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewReasonForm, setShowNewReasonForm] = useState(false)
  const [newReasonName, setNewReasonName] = useState('')
  const [newReasonLevel, setNewReasonLevel] = useState<1 | 2 | 3>(3)

  useEffect(() => {
    loadReasons()
  }, [machineId])

  const loadReasons = async () => {
    const data = await getReasonHierarchy(machineId)
    setHierarchy(data as ReasonWithChildren[])
  }

  const nv2Options = selectedNV1
    ? hierarchy.find((r) => r.id === selectedNV1)?.children ?? []
    : []

  const nv3Options = selectedNV2
    ? nv2Options.find((r) => r.id === selectedNV2)?.children ?? []
    : []

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedNV1) {
      setError('Selecione ao menos o motivo NV1')
      return
    }

    if (!duration || parseInt(duration) <= 0) {
      setError('Duração deve ser maior que zero')
      return
    }

    setSaving(true)

    try {
      await saveDowntimeEvent({
        productionDayId,
        reasonId: selectedNV3 || selectedNV2 || selectedNV1,
        durationMinutes: parseInt(duration),
        notes: notes || undefined,
      })

      // Reset form
      setSelectedNV1('')
      setSelectedNV2('')
      setSelectedNV3('')
      setDuration('')
      setNotes('')
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Remover esta parada?')) return

    try {
      await deleteDowntimeEvent(id)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  const handleCreateReason = async () => {
    if (!newReasonName.trim()) return

    try {
      let parentId: string | undefined

      if (newReasonLevel === 2 && selectedNV1) {
        parentId = selectedNV1
      } else if (newReasonLevel === 3 && selectedNV2) {
        parentId = selectedNV2
      }

      await createReason({
        name: newReasonName.trim(),
        level: newReasonLevel,
        parentId,
        machineId,
      })

      setNewReasonName('')
      setShowNewReasonForm(false)
      await loadReasons()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar motivo')
    }
  }

  const totalDowntimeMinutes = existingEvents.reduce((sum, e) => sum + e.durationMinutes, 0)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
        Paradas
      </h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Lista de paradas existentes */}
      {existingEvents.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-[#2d3e7e] mb-2">
            Total: {totalDowntimeMinutes} min
          </div>
          <div className="space-y-2">
            {existingEvents.map((event) => (
              <div
                key={event.id}
                className="flex justify-between items-center bg-[#dc2626]/10 border border-[#dc2626]/20 p-3 rounded-md text-sm"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {event.reason.parent?.parent?.name
                      ? `${event.reason.parent.parent.name} > ${event.reason.parent.name} > ${event.reason.name}`
                      : event.reason.parent?.name
                        ? `${event.reason.parent.name} > ${event.reason.name}`
                        : event.reason.name}
                  </span>
                  <span className="text-[#2d3e7e] ml-2 font-medium">({event.durationMinutes} min)</span>
                  {event.notes && (
                    <span className="text-gray-500 ml-2">- {event.notes}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário para adicionar nova parada */}
      <form onSubmit={handleAddEvent} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NV1 *</label>
            <select
              value={selectedNV1}
              onChange={(e) => {
                setSelectedNV1(e.target.value)
                setSelectedNV2('')
                setSelectedNV3('')
              }}
            >
              <option value="">Selecione...</option>
              {hierarchy.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NV2</label>
            <select
              value={selectedNV2}
              onChange={(e) => {
                setSelectedNV2(e.target.value)
                setSelectedNV3('')
              }}
              disabled={!selectedNV1}
            >
              <option value="">Selecione...</option>
              {nv2Options.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NV3</label>
            <select
              value={selectedNV3}
              onChange={(e) => setSelectedNV3(e.target.value)}
              disabled={!selectedNV2}
            >
              <option value="">Selecione...</option>
              {nv3Options.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Duração (min) *</label>
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 30"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#dc2626] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Salvando...' : 'Adicionar Parada'}
          </button>
          <button
            type="button"
            onClick={() => setShowNewReasonForm(!showNewReasonForm)}
            className="text-sm text-[#2d3e7e] font-medium hover:text-[#dc2626] px-3"
          >
            + Motivo
          </button>
        </div>
      </form>

      {/* Formulário para criar novo motivo */}
      {showNewReasonForm && (
        <div className="mt-4 p-4 bg-[#dc2626]/10 rounded-lg border border-[#dc2626]/20">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Criar Novo Motivo</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={newReasonName}
              onChange={(e) => setNewReasonName(e.target.value)}
              placeholder="Nome do motivo"
            />
            <div className="flex gap-2">
              <select
                value={newReasonLevel}
                onChange={(e) => setNewReasonLevel(parseInt(e.target.value) as 1 | 2 | 3)}
                className="flex-1"
              >
                <option value={1}>NV1 (Categoria)</option>
                <option value={2}>NV2 (Sub) - requer NV1</option>
                <option value={3}>NV3 (Motivo) - requer NV2</option>
              </select>
              <button
                type="button"
                onClick={handleCreateReason}
                className="bg-[#2d3e7e] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#3a4d94] transition-colors"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
