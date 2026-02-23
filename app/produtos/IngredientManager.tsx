'use client'

import { useState } from 'react'
import { fmtDec } from '@/lib/format'

interface Ingredient {
  id: string
  name: string
  unit: string
  unitPrice: number
}

interface Props {
  ingredients: Ingredient[]
  onClose: () => void
  onCreate: (data: { name: string; unit: string; unitPrice: number }) => Promise<unknown>
  onUpdate: (id: string, data: { name?: string; unit?: string; unitPrice?: number }) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
}

export function IngredientManager({ ingredients, onClose, onCreate, onUpdate, onDelete }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [unitPrice, setUnitPrice] = useState(0)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), unit, unitPrice })
      setName('')
      setUnit('kg')
      setUnitPrice(0)
      setShowNewForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar ingrediente')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string, data: { name?: string; unit?: string; unitPrice?: number }) => {
    setLoading(true)
    setError(null)
    try {
      await onUpdate(id, data)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar ingrediente')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, ingredientName: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${ingredientName}"? Isso afetará todas as receitas que usam este ingrediente.`)) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir ingrediente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Gerenciar Ingredientes</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Botão adicionar */}
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center px-4 py-2 bg-[#3bbfb5] text-white rounded-md hover:bg-[#2ea69d] transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Ingrediente
            </button>
          )}

          {/* Formulário de novo ingrediente */}
          {showNewForm && (
            <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900">Novo Ingrediente</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                    placeholder="Ex: Areia Grossa"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  >
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                    <option value="L">L</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#3bbfb5] text-white rounded-md hover:bg-[#2ea69d] disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Salvando...' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(false)
                    setName('')
                    setUnit('kg')
                    setUnitPrice(0)
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de ingredientes */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Unit. (R$)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ingredients.map((ingredient) => (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    isEditing={editingId === ingredient.id}
                    onEdit={() => setEditingId(ingredient.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={(data) => handleUpdate(ingredient.id, data)}
                    onDelete={() => handleDelete(ingredient.id, ingredient.name)}
                    loading={loading}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {ingredients.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum ingrediente cadastrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface IngredientRowProps {
  ingredient: Ingredient
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (data: { name?: string; unit?: string; unitPrice?: number }) => void
  onDelete: () => void
  loading: boolean
}

function IngredientRow({ ingredient, isEditing, onEdit, onCancel, onSave, onDelete, loading }: IngredientRowProps) {
  const [name, setName] = useState(ingredient.name)
  const [unit, setUnit] = useState(ingredient.unit)
  const [unitPrice, setUnitPrice] = useState(ingredient.unitPrice)

  if (isEditing) {
    return (
      <tr>
        <td className="px-4 py-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
          />
        </td>
        <td className="px-4 py-3">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
          >
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="un">un</option>
            <option value="L">L</option>
          </select>
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            step="0.0001"
            value={unitPrice}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            className="w-full text-right rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
          />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onSave({ name, unit, unitPrice })}
              disabled={loading}
              className="px-3 py-1 text-sm bg-[#3bbfb5] text-white rounded hover:bg-[#2ea69d] disabled:opacity-50 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="px-4 py-3 text-sm text-gray-900">{ingredient.name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{ingredient.unit}</td>
      <td className="px-4 py-3 text-sm text-gray-900 text-right">
        {fmtDec(ingredient.unitPrice, 4)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-[#2d3e7e] transition-colors"
            title="Editar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Excluir"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
