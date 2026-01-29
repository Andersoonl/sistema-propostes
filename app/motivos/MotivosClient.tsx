'use client'

import { useState, useEffect } from 'react'
import type { Machine, DowntimeReason } from '@/app/generated/prisma/client'
import {
  getReasonHierarchyForManagement,
  createReason,
  updateReason,
  deleteReason,
} from '@/app/actions/reasons'

type ReasonWithChildren = DowntimeReason & {
  children: (DowntimeReason & {
    children: DowntimeReason[]
  })[]
}

interface MotivosClientProps {
  machines: Machine[]
}

export function MotivosClient({ machines }: MotivosClientProps) {
  const [selectedMachineId, setSelectedMachineId] = useState(machines[0]?.id || '')
  const [hierarchy, setHierarchy] = useState<ReasonWithChildren[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Expanded state for NV1 and NV2 sections
  const [expandedNV1, setExpandedNV1] = useState<Set<string>>(new Set())
  const [expandedNV2, setExpandedNV2] = useState<Set<string>>(new Set())

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Add new reason state
  const [addingTo, setAddingTo] = useState<{ level: 1 | 2 | 3; parentId?: string } | null>(null)
  const [newReasonName, setNewReasonName] = useState('')

  const loadHierarchy = async () => {
    if (!selectedMachineId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getReasonHierarchyForManagement(selectedMachineId)
      setHierarchy(data as ReasonWithChildren[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar motivos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHierarchy()
    setExpandedNV1(new Set())
    setExpandedNV2(new Set())
    setEditingId(null)
    setAddingTo(null)
  }, [selectedMachineId])

  const toggleNV1 = (id: string) => {
    setExpandedNV1((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleNV2 = (id: string) => {
    setExpandedNV2((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    setError(null)
    try {
      await updateReason(editingId, editingName.trim())
      setEditingId(null)
      setEditingName('')
      await loadHierarchy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renomear')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}" e todos seus sub-motivos?`)) return
    setError(null)
    try {
      await deleteReason(id)
      await loadHierarchy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleStartAdd = (level: 1 | 2 | 3, parentId?: string) => {
    setAddingTo({ level, parentId })
    setNewReasonName('')
  }

  const handleSaveAdd = async () => {
    if (!addingTo || !newReasonName.trim()) return
    setError(null)
    try {
      await createReason({
        name: newReasonName.trim(),
        level: addingTo.level,
        parentId: addingTo.parentId,
        machineId: selectedMachineId,
      })
      setAddingTo(null)
      setNewReasonName('')
      await loadHierarchy()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar motivo')
    }
  }

  const handleCancelAdd = () => {
    setAddingTo(null)
    setNewReasonName('')
  }

  const selectedMachine = machines.find((m) => m.id === selectedMachineId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Motivos de Parada</h1>

        {/* Machine tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {machines.map((machine) => (
            <button
              key={machine.id}
              onClick={() => setSelectedMachineId(machine.id)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedMachineId === machine.id
                  ? 'bg-[#2d3e7e] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              {machine.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
          {error}
        </div>
      )}

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
        <div className="space-y-2">
          {hierarchy.map((nv1) => (
            <div key={nv1.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* NV1 header */}
              <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                <button
                  onClick={() => toggleNV1(nv1.id)}
                  className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center flex-shrink-0"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedNV1.has(nv1.id) ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {editingId === nv1.id ? (
                  <InlineEdit
                    value={editingName}
                    onChange={setEditingName}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <>
                    <span className="font-semibold text-[#2d3e7e] text-sm flex-1">
                      {nv1.name}
                    </span>
                    <span className="text-xs text-gray-400 mr-2">NV1</span>
                    <ActionButtons
                      onEdit={() => handleStartEdit(nv1.id, nv1.name)}
                      onDelete={() => handleDelete(nv1.id, nv1.name)}
                    />
                  </>
                )}
              </div>

              {/* NV2 children */}
              {expandedNV1.has(nv1.id) && (
                <div className="pl-6 py-1">
                  {nv1.children.map((nv2) => (
                    <div key={nv2.id}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => toggleNV2(nv2.id)}
                          className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center flex-shrink-0"
                        >
                          {nv2.children.length > 0 ? (
                            <svg
                              className={`w-3.5 h-3.5 transition-transform ${expandedNV2.has(nv2.id) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          ) : (
                            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                          )}
                        </button>

                        {editingId === nv2.id ? (
                          <InlineEdit
                            value={editingName}
                            onChange={setEditingName}
                            onSave={handleSaveEdit}
                            onCancel={handleCancelEdit}
                          />
                        ) : (
                          <>
                            <span className="text-sm text-gray-800 flex-1">{nv2.name}</span>
                            <span className="text-xs text-gray-400 mr-2">NV2</span>
                            <ActionButtons
                              onEdit={() => handleStartEdit(nv2.id, nv2.name)}
                              onDelete={() => handleDelete(nv2.id, nv2.name)}
                              onAdd={() => handleStartAdd(3, nv2.id)}
                              addLabel="+ NV3"
                            />
                          </>
                        )}
                      </div>

                      {/* NV3 children */}
                      {expandedNV2.has(nv2.id) && nv2.children.length > 0 && (
                        <div className="pl-10 pb-1">
                          {nv2.children.map((nv3) => (
                            <div key={nv3.id} className="flex items-center gap-2 px-3 py-1.5">
                              <span className="w-1.5 h-1.5 bg-[#3bbfb5] rounded-full flex-shrink-0" />

                              {editingId === nv3.id ? (
                                <InlineEdit
                                  value={editingName}
                                  onChange={setEditingName}
                                  onSave={handleSaveEdit}
                                  onCancel={handleCancelEdit}
                                />
                              ) : (
                                <>
                                  <span className="text-sm text-gray-600 flex-1">{nv3.name}</span>
                                  <span className="text-xs text-gray-400 mr-2">NV3</span>
                                  <ActionButtons
                                    onEdit={() => handleStartEdit(nv3.id, nv3.name)}
                                    onDelete={() => handleDelete(nv3.id, nv3.name)}
                                  />
                                </>
                              )}
                            </div>
                          ))}

                          {/* Inline add NV3 */}
                          {addingTo?.level === 3 && addingTo.parentId === nv2.id && (
                            <div className="flex items-center gap-2 px-3 py-1.5">
                              <span className="w-1.5 h-1.5 bg-[#3bbfb5]/40 rounded-full flex-shrink-0" />
                              <InlineEdit
                                value={newReasonName}
                                onChange={setNewReasonName}
                                onSave={handleSaveAdd}
                                onCancel={handleCancelAdd}
                                placeholder="Nome do NV3..."
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Inline add NV2 */}
                  {addingTo?.level === 2 && addingTo.parentId === nv1.id && (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="w-5 h-5 flex-shrink-0" />
                      <InlineEdit
                        value={newReasonName}
                        onChange={setNewReasonName}
                        onSave={handleSaveAdd}
                        onCancel={handleCancelAdd}
                        placeholder="Nome do NV2..."
                      />
                    </div>
                  )}

                  <div className="px-3 py-2">
                    <button
                      onClick={() => handleStartAdd(2, nv1.id)}
                      className="text-xs text-[#3bbfb5] hover:text-[#2d3e7e] font-medium"
                    >
                      + Adicionar NV2
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add NV1 */}
          {addingTo?.level === 1 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0" />
                <InlineEdit
                  value={newReasonName}
                  onChange={setNewReasonName}
                  onSave={handleSaveAdd}
                  onCancel={handleCancelAdd}
                  placeholder="Nome do NV1..."
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleStartAdd(1)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#3bbfb5] hover:text-[#2d3e7e] transition-colors font-medium"
            >
              + Adicionar NV1
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function InlineEdit({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="flex-1 text-sm border border-[#3bbfb5] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#3bbfb5]"
        autoFocus
      />
      <button
        onClick={onSave}
        className="text-[#3bbfb5] hover:text-green-600 p-1"
        title="Salvar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-red-500 p-1"
        title="Cancelar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ActionButtons({
  onEdit,
  onDelete,
  onAdd,
  addLabel,
}: {
  onEdit: () => void
  onDelete: () => void
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div className="flex items-center gap-1">
      {onAdd && (
        <button
          onClick={onAdd}
          className="text-xs text-[#3bbfb5] hover:text-[#2d3e7e] font-medium px-1"
        >
          {addLabel}
        </button>
      )}
      <button
        onClick={onEdit}
        className="text-gray-400 hover:text-[#2d3e7e] p-0.5"
        title="Editar"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        className="text-gray-400 hover:text-red-500 p-0.5"
        title="Excluir"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
