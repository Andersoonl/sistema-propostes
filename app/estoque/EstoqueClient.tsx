'use client'

import { useState } from 'react'
import { fmtInt, fmtMax } from '@/lib/format'
import {
  createMovement,
  deleteMovement,
  getProductStock,
  getMovements,
} from '@/app/actions/inventory'
import type { ProductStockItem } from '@/app/actions/inventory'

interface Product {
  id: string
  name: string
}

interface InventoryMovement {
  id: string
  productId: string
  date: Date | string
  type: string
  quantityPieces: number
  quantityPallets: number | null
  areaM2: number | null
  notes: string | null
  productionDayId: string | null
  palletizationId: string | null
  product: Product
}

interface EstoqueClientProps {
  initialStock: ProductStockItem[]
  initialMovements: InventoryMovement[]
  products: Product[]
}

export function EstoqueClient({
  initialStock,
  initialMovements,
  products,
}: EstoqueClientProps) {
  const [stock, setStock] = useState(initialStock)
  const [movements, setMovements] = useState(initialMovements)
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    productId: '',
    date: new Date().toISOString().split('T')[0],
    quantityPieces: 0,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = async () => {
    const [newStock, newMovements] = await Promise.all([
      getProductStock(),
      getMovements(),
    ])
    setStock(newStock)
    setMovements(newMovements)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.productId) {
      setError('Selecione um produto')
      return
    }
    if (formData.quantityPieces <= 0) {
      setError('Quantidade deve ser maior que zero')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createMovement({
        productId: formData.productId,
        date: new Date(formData.date + 'T12:00:00'),
        type: 'OUT',
        quantityPieces: formData.quantityPieces,
        notes: formData.notes || undefined,
      })

      setFormData({
        productId: '',
        date: new Date().toISOString().split('T')[0],
        quantityPieces: 0,
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
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) return
    try {
      await deleteMovement(id)
      await refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const totalCuring = stock.reduce((sum, item) => sum + item.curingPieces, 0)
  const totalAvailable = stock.reduce((sum, item) => sum + item.availablePieces, 0)
  const totalLoose = stock.reduce((sum, item) => sum + item.loosePieces, 0)
  const totalPallets = stock.reduce((sum, item) => sum + (item.availablePallets || 0), 0)
  const totalM2 = stock.reduce((sum, item) => sum + (item.availableM2 || 0), 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Estoque de Produto Acabado (Pátio)</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#2d3e7e] text-white rounded-lg hover:bg-[#243269] transition-colors font-medium"
        >
          {showForm ? 'Cancelar' : '+ Registrar Saída'}
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Em Cura</div>
          <div className="text-3xl font-bold text-amber-600">{fmtInt(totalCuring)}</div>
          <div className="text-xs text-gray-400">peças</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Disponível</div>
          <div className="text-3xl font-bold text-teal-600">{fmtInt(totalAvailable)}</div>
          <div className="text-xs text-gray-400">peças</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Peças Soltas</div>
          <div className="text-3xl font-bold text-purple-600">{fmtInt(totalLoose)}</div>
          <div className="text-xs text-gray-400">acumulado</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Pallets</div>
          <div className="text-3xl font-bold text-indigo-600">
            {fmtMax(totalPallets, 1)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total m²</div>
          <div className="text-3xl font-bold text-teal-600">
            {fmtMax(totalM2, 1)}
          </div>
        </div>
      </div>

      {/* Formulário de saída */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Registrar Saída de Estoque</h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade (peças)</label>
                <input
                  type="number"
                  value={formData.quantityPieces || ''}
                  onChange={(e) => setFormData({ ...formData, quantityPieces: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  required
                  min={1}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ex: Venda cliente X, Transferência..."
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#2d3e7e] text-white rounded-lg hover:bg-[#243269] disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Salvando...' : 'Registrar Saída'}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {([
          { key: 'stock' as const, label: 'Estoque Atual' },
          { key: 'movements' as const, label: 'Histórico de Movimentações' },
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
            <div className="p-8 text-center text-gray-500">Nenhum produto em estoque. Lance produção e paletize para gerar entradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Em Cura (pçs)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Disponível (pçs)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Soltas</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pallets</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">m²</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Mov.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stock.map((item) => (
                    <tr key={item.productId} className={item.availablePieces <= 0 && item.curingPieces <= 0 ? 'bg-gray-50 text-gray-400' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {item.curingPieces > 0 ? (
                          <span className="text-amber-600 font-semibold">{fmtInt(item.curingPieces)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${
                        item.availablePieces > 0 ? 'text-teal-600' : 'text-gray-400'
                      }`}>
                        {fmtInt(item.availablePieces)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {item.loosePieces > 0 ? (
                          <span className="text-purple-600 font-semibold">{fmtInt(item.loosePieces)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-indigo-600">
                        {item.availablePallets !== null ? fmtMax(item.availablePallets, 1) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-teal-600">
                        {item.availableM2 !== null ? fmtMax(item.availableM2, 1) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {item.lastMovementDate
                          ? new Date(item.lastMovementDate + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Histórico de Movimentações */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma movimentação registrada</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peças</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pallets</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Obs</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((mov) => {
                    const movDate = new Date(mov.date)
                    const isAuto = mov.type === 'IN' && (mov.productionDayId || mov.palletizationId)
                    const autoLabel = mov.palletizationId ? '(palet.)' : '(legado)'
                    return (
                      <tr key={mov.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          {movDate.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            mov.type === 'IN'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {mov.type === 'IN' ? 'Entrada' : 'Saída'}
                            {isAuto && (
                              <span className="ml-1 text-green-500" title={mov.palletizationId ? 'Gerado pela paletização' : 'Gerado automaticamente pela produção (legado)'}>
                                {autoLabel}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {mov.product.name}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${
                          mov.type === 'IN' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {mov.type === 'IN' ? '+' : '-'}{fmtInt(mov.quantityPieces)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                          {mov.quantityPallets
                            ? fmtMax(mov.quantityPallets, 1)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">
                          {mov.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {!isAuto && (
                            <button
                              onClick={() => handleDelete(mov.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Excluir
                            </button>
                          )}
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
    </div>
  )
}
