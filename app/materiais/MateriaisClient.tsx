'use client'

import { useState } from 'react'
import { fmtDec, fmtMax, fmtMoney } from '@/lib/format'
import { MonthPicker } from '@/app/components/DatePicker'
import {
  createMaterialEntry,
  deleteMaterialEntry,
  getMaterialStock,
  getMaterialEntries,
  getMonthlyConsumption,
} from '@/app/actions/materials'

interface Ingredient {
  id: string
  name: string
  unit: string
  unitPrice: number
}

interface MaterialStockItem {
  ingredientId: string
  ingredientName: string
  unit: string
  unitPrice: number
  totalPurchased: number
  totalConsumed: number
  balance: number
  estimatedValue: number
}

interface MaterialEntry {
  id: string
  ingredientId: string
  date: Date | string
  quantity: number
  unitPrice: number
  supplier: string | null
  invoiceNumber: string | null
  notes: string | null
  ingredient: Ingredient
}

interface IngredientConsumption {
  ingredientId: string
  ingredientName: string
  unit: string
  totalConsumed: number
}

interface MateriaisClientProps {
  initialStock: MaterialStockItem[]
  initialEntries: MaterialEntry[]
  ingredients: Ingredient[]
  initialConsumption: IngredientConsumption[]
  initialYear: number
  initialMonth: number
}

export function MateriaisClient({
  initialStock,
  initialEntries,
  ingredients,
  initialConsumption,
  initialYear,
  initialMonth,
}: MateriaisClientProps) {
  const [stock, setStock] = useState(initialStock)
  const [entries, setEntries] = useState(initialEntries)
  const [consumption, setConsumption] = useState(initialConsumption)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'stock' | 'entries' | 'consumption'>('stock')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    ingredientId: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    unitPrice: 0,
    supplier: '',
    invoiceNumber: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMonthChange = async (newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)
    const newConsumption = await getMonthlyConsumption(newYear, newMonth)
    setConsumption(newConsumption)
    setLoading(false)
  }

  const refreshData = async () => {
    const [newStock, newEntries, newConsumption] = await Promise.all([
      getMaterialStock(),
      getMaterialEntries(),
      getMonthlyConsumption(year, month),
    ])
    setStock(newStock)
    setEntries(newEntries)
    setConsumption(newConsumption)
  }

  const handleIngredientSelect = (ingredientId: string) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId)
    setFormData({
      ...formData,
      ingredientId,
      unitPrice: ingredient?.unitPrice || 0,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.ingredientId) {
      setError('Selecione um material')
      return
    }
    if (formData.quantity <= 0) {
      setError('Quantidade deve ser maior que zero')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createMaterialEntry({
        ingredientId: formData.ingredientId,
        date: new Date(formData.date + 'T12:00:00'),
        quantity: formData.quantity,
        unitPrice: formData.unitPrice,
        supplier: formData.supplier || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        notes: formData.notes || undefined,
      })

      setFormData({
        ingredientId: '',
        date: new Date().toISOString().split('T')[0],
        quantity: 0,
        unitPrice: 0,
        supplier: '',
        invoiceNumber: '',
        notes: '',
      })
      setShowForm(false)
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return
    await deleteMaterialEntry(id)
    await refreshData()
  }

  const totalStockValue = stock.reduce((sum, item) => sum + Math.max(0, item.estimatedValue), 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Materiais (Matéria Prima)</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          {showForm ? 'Cancelar' : '+ Registrar Compra'}
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Materiais Cadastrados</div>
          <div className="text-3xl font-bold text-gray-900">{ingredients.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Valor Total em Estoque</div>
          <div className="text-3xl font-bold text-[#2d3e7e]">
            {fmtMoney(totalStockValue)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Entradas Registradas</div>
          <div className="text-3xl font-bold text-[#3bbfb5]">{entries.length}</div>
        </div>
      </div>

      {/* Formulário de compra */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Registrar Compra de Material</h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                <select
                  value={formData.ingredientId}
                  onChange={(e) => handleIngredientSelect(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  required
                  min={0.01}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário (R$)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.unitPrice || ''}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            {formData.quantity > 0 && formData.unitPrice > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                Valor total: <span className="font-bold">
                  {fmtMoney(formData.quantity * formData.unitPrice)}
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Salvando...' : 'Registrar Compra'}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {([
          { key: 'stock' as const, label: 'Estoque Atual' },
          { key: 'entries' as const, label: 'Histórico de Compras' },
          { key: 'consumption' as const, label: 'Consumo do Mês' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabela de Estoque */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {stock.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum material cadastrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Comprado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Consumido</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Est.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stock.map((item) => (
                    <tr key={item.ingredientId} className={item.balance < 0 ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.ingredientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{item.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {fmtMax(item.totalPurchased, 2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {fmtMax(item.totalConsumed, 2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${
                        item.balance < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {fmtMax(item.balance, 2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {fmtMoney(Math.max(0, item.estimatedValue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Histórico de Entradas */}
      {activeTab === 'entries' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma compra registrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NF</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry) => {
                    const entryDate = new Date(entry.date)
                    return (
                      <tr key={entry.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          {entryDate.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {entry.ingredient.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {fmtMax(entry.quantity, 2)} {entry.ingredient.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                          {fmtMoney(entry.unitPrice, 4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">
                          {fmtMoney(entry.quantity * entry.unitPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {entry.supplier || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {entry.invoiceNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Consumo do Mês */}
      {activeTab === 'consumption' && (
        <div>
          <div className="mb-4 flex justify-end">
            <MonthPicker year={year} month={month} onChange={handleMonthChange} />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : consumption.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhum consumo registrado neste mês</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Consumido</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {consumption.map((item) => (
                      <tr key={item.ingredientId}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.ingredientName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{item.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-orange-600">
                          {fmtMax(item.totalConsumed, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
