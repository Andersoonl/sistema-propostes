'use client'

import { useState } from 'react'
import type { Machine, Product, ProductionDay, ProductionItem } from '@/app/generated/prisma/client'
import { saveProductionDay } from '@/app/actions/production'

interface ProductionFormProps {
  machine: Machine
  products: Product[]
  date: Date
  existingData?: ProductionDay & {
    productionItems: (ProductionItem & { product: Product })[]
  }
  onSaved?: () => void
}

interface ProductionItemInput {
  productId: string
  cycles: number
  startTime: string
  endTime: string
}

export function ProductionForm({
  machine,
  products,
  date,
  existingData,
  onSaved,
}: ProductionFormProps) {
  const [hasProductSwap, setHasProductSwap] = useState(existingData?.hasProductSwap ?? false)
  const [notes, setNotes] = useState(existingData?.notes ?? '')
  const [items, setItems] = useState<ProductionItemInput[]>(
    existingData?.productionItems.map((item) => ({
      productId: item.productId,
      cycles: item.cycles,
      startTime: item.startTime ?? '',
      endTime: item.endTime ?? '',
    })) ?? [{ productId: '', cycles: 0, startTime: '', endTime: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addItem = () => {
    if (items.length >= 2) {
      setError('Máximo de 2 produtos por dia')
      return
    }
    setItems([...items, { productId: '', cycles: 0, startTime: '', endTime: '' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ProductionItemInput, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Permite ciclos = 0 para registrar dias sem produção (ex: máquina parada por quebra)
      const validItems = items.filter((item) => item.productId && item.cycles >= 0)

      await saveProductionDay({
        machineId: machine.id,
        date,
        hasProductSwap,
        notes: notes || undefined,
        items: validItems.map((item) => ({
          productId: item.productId,
          cycles: item.cycles,
          startTime: item.startTime || undefined,
          endTime: item.endTime || undefined,
        })),
      })

      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const machineColor = machine.name === 'VP1'
    ? { text: 'text-green-600', border: 'border-green-200', bg: 'bg-green-600 hover:bg-green-700' }
    : machine.name === 'VP2'
    ? { text: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-600 hover:bg-blue-700' }
    : { text: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-600 hover:bg-orange-700' }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
      <h3 className={`text-lg font-semibold mb-4 pb-2 border-b ${machineColor.text} ${machineColor.border}`}>
        {machine.name}
      </h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasProductSwap}
            onChange={(e) => setHasProductSwap(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Troca de produto?</span>
        </label>

        {items.map((item, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">
                Produto {index + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 text-sm font-medium hover:text-red-800"
                >
                  Remover
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Produto</label>
              <select
                value={item.productId}
                onChange={(e) => updateItem(index, 'productId', e.target.value)}
              >
                <option value="">Selecione um produto...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ciclos</label>
              <input
                type="number"
                min="0"
                value={item.cycles}
                onChange={(e) => updateItem(index, 'cycles', e.target.value === '' ? 0 : parseInt(e.target.value))}
                placeholder="Digite a quantidade de ciclos"
              />
            </div>

            {hasProductSwap && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Início</label>
                  <input
                    type="time"
                    value={item.startTime}
                    onChange={(e) => updateItem(index, 'startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fim</label>
                  <input
                    type="time"
                    value={item.endTime}
                    onChange={(e) => updateItem(index, 'endTime', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {items.length < 2 && (
          <button
            type="button"
            onClick={addItem}
            className={`text-sm font-medium flex items-center gap-1 ${machineColor.text} hover:opacity-80`}
          >
            <span className="text-lg leading-none">+</span> Adicionar produto
          </button>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcional - adicione observações aqui..."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full text-white py-2.5 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${machineColor.bg}`}
        >
          {saving ? 'Salvando...' : 'Salvar Produção'}
        </button>
      </div>
    </form>
  )
}
