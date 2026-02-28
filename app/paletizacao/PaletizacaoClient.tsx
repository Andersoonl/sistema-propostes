'use client'

import { useState } from 'react'
import { fmtInt, fmtDec } from '@/lib/format'
import {
  getPendingPalletizations,
  getPalletizationHistory,
  getLoosePiecesBalances,
  savePalletization,
  deletePalletization,
  formPalletFromLoose,
} from '@/app/actions/palletization'
import type {
  PendingPalletization,
  MissingRecipeItem,
  PalletizationRecord,
  LoosePiecesItem,
} from '@/app/actions/palletization'

type Tab = 'pending' | 'history' | 'loose'

interface PaletizacaoClientProps {
  initialPending: PendingPalletization[]
  initialMissingRecipe: MissingRecipeItem[]
  initialHistory: PalletizationRecord[]
  initialLoose: LoosePiecesItem[]
}

export function PaletizacaoClient({
  initialPending,
  initialMissingRecipe,
  initialHistory,
  initialLoose,
}: PaletizacaoClientProps) {
  const [pending, setPending] = useState(initialPending)
  const [missingRecipe, setMissingRecipe] = useState(initialMissingRecipe)
  const [history, setHistory] = useState(initialHistory)
  const [loose, setLoose] = useState(initialLoose)
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state para paletização
  const [formPallets, setFormPallets] = useState(0)
  const [formLoose, setFormLoose] = useState(0)
  const [formNotes, setFormNotes] = useState('')

  const refreshData = async () => {
    const [pendingData, newHistory, newLoose] = await Promise.all([
      getPendingPalletizations(),
      getPalletizationHistory(),
      getLoosePiecesBalances(),
    ])
    setPending(pendingData.items)
    setMissingRecipe(pendingData.missingRecipe)
    setHistory(newHistory)
    setLoose(newLoose)
  }

  const handleExpand = (key: string) => {
    if (expandedRow === key) {
      setExpandedRow(null)
      return
    }
    setExpandedRow(key)
    setFormPallets(0)
    setFormLoose(0)
    setFormNotes('')
    setError(null)
  }

  const handleSavePalletization = async (item: PendingPalletization) => {
    setSaving(true)
    setError(null)
    try {
      await savePalletization({
        productId: item.productId,
        productionDate: item.productionDate,
        completePallets: formPallets,
        loosePiecesAfter: formLoose,
        notes: formNotes || undefined,
      })
      setExpandedRow(null)
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar paletização')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePalletization = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta paletização? O estoque será revertido.')) return
    try {
      await deletePalletization(id)
      await refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleFormPallet = async (productId: string) => {
    if (!confirm('Formar 1 pallet com as peças soltas?')) return
    try {
      await formPalletFromLoose(productId)
      await refreshData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao formar pallet')
    }
  }

  // KPIs
  const pendingCount = pending.length + missingRecipe.length
  const todayStr = new Date().toISOString().split('T')[0]
  const palletizedToday = history.filter((h) => h.palletizedDate === todayStr)
  const palletsToday = palletizedToday.reduce((sum, h) => sum + h.completePallets, 0)
  const lossToday = palletizedToday.reduce((sum, h) => sum + h.lossPieces, 0)
  const totalLoose = loose.reduce((sum, l) => sum + l.pieces, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paletização</h1>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pendentes</div>
          <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Paletizados Hoje</div>
          <div className="text-3xl font-bold text-green-600">{fmtInt(palletsToday)}</div>
          <div className="text-xs text-gray-400">pallets</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Perda Hoje</div>
          <div className="text-3xl font-bold text-red-600">{fmtInt(lossToday)}</div>
          <div className="text-xs text-gray-400">peças</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Peças Soltas</div>
          <div className="text-3xl font-bold text-purple-600">{fmtInt(totalLoose)}</div>
          <div className="text-xs text-gray-400">acumulado</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {([
          { key: 'pending' as const, label: `Pendentes (${pendingCount})` },
          { key: 'history' as const, label: 'Histórico' },
          { key: 'loose' as const, label: `Peças Soltas (${loose.length})` },
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

      {/* Tab Pendentes */}
      {activeTab === 'pending' && (
        <>
        {/* Aviso de produtos sem receita */}
        {missingRecipe.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg mt-0.5">!</span>
              <div>
                <div className="font-medium text-amber-800">
                  {missingRecipe.length} {missingRecipe.length === 1 ? 'produção aguardando' : 'produções aguardando'} configuração de receita
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  Para paletizar, o produto precisa ter uma Receita de Custo com &quot;Peças por Pallet&quot; definido.
                  Configure em <a href="/produtos" className="underline font-medium">Produtos</a>.
                </p>
                <div className="mt-2 space-y-1">
                  {missingRecipe.map((item) => (
                    <div key={`${item.productId}|${item.productionDate}`} className="text-sm text-amber-700">
                      <span className="font-medium">{item.productName}</span>
                      {' — '}
                      {new Date(item.productionDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {' — '}
                      {fmtInt(item.totalCycles)} ciclos
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {pending.length === 0 && missingRecipe.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma paletização pendente. A produção de hoje aparecerá aqui amanhã.
            </div>
          ) : pending.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Todos os itens pendentes precisam de receita configurada (veja aviso acima).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Prod.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Teórico (pçs)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Soltas Acum.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pçs/Pallet</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pending.map((item) => {
                    const rowKey = `${item.productId}|${item.productionDate}`
                    const isExpanded = expandedRow === rowKey
                    const totalDisponivel = item.theoreticalPieces + item.loosePiecesBefore
                    const realPieces = formPallets * item.piecesPerPallet
                    const lossPieces = totalDisponivel - realPieces - formLoose
                    const lossPct = totalDisponivel > 0 ? (lossPieces / totalDisponivel) * 100 : 0
                    const lossNegative = lossPieces < 0

                    return (
                      <tr key={rowKey} className="group">
                        <td colSpan={6} className="p-0">
                          {/* Linha principal */}
                          <div className="grid grid-cols-6 items-center">
                            <div className="px-6 py-4 whitespace-nowrap text-gray-900">
                              {new Date(item.productionDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            <div className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                              {item.productName}
                            </div>
                            <div className="px-6 py-4 whitespace-nowrap text-right text-indigo-600 font-semibold">
                              {fmtInt(item.theoreticalPieces)}
                            </div>
                            <div className="px-6 py-4 whitespace-nowrap text-right">
                              {item.loosePiecesBefore > 0 ? (
                                <span className="text-purple-600 font-semibold">{fmtInt(item.loosePiecesBefore)}</span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </div>
                            <div className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                              {fmtInt(item.piecesPerPallet)}
                            </div>
                            <div className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleExpand(rowKey)}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                  isExpanded
                                    ? 'bg-gray-200 text-gray-700'
                                    : 'bg-[#2d3e7e] text-white hover:bg-[#243269]'
                                }`}
                              >
                                {isExpanded ? 'Cancelar' : 'Paletizar'}
                              </button>
                            </div>
                          </div>

                          {/* Formulário inline expandido */}
                          {isExpanded && (
                            <div className="px-6 pb-4 bg-blue-50 border-t border-blue-100">
                              <div className="pt-4 space-y-4">
                                {/* Info resumo */}
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div className="bg-white rounded p-3">
                                    <div className="text-gray-500">Produção teórica</div>
                                    <div className="text-lg font-bold text-indigo-600">{fmtInt(item.theoreticalPieces)} pçs</div>
                                  </div>
                                  <div className="bg-white rounded p-3">
                                    <div className="text-gray-500">Soltas anteriores</div>
                                    <div className="text-lg font-bold text-purple-600">{fmtInt(item.loosePiecesBefore)} pçs</div>
                                  </div>
                                  <div className="bg-white rounded p-3">
                                    <div className="text-gray-500">Total disponível</div>
                                    <div className="text-lg font-bold text-gray-900">{fmtInt(totalDisponivel)} pçs</div>
                                  </div>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Pallets completos
                                    </label>
                                    <input
                                      type="number"
                                      value={formPallets || ''}
                                      onChange={(e) => setFormPallets(parseInt(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                      min={0}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {formPallets > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        = {fmtInt(realPieces)} peças
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Peças soltas restantes
                                    </label>
                                    <input
                                      type="number"
                                      value={formLoose || ''}
                                      onChange={(e) => setFormLoose(parseInt(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                      min={0}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                </div>

                                {/* Observações */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Observações (opcional)
                                  </label>
                                  <input
                                    type="text"
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder="Ex: Lote com defeito parcial..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>

                                {/* Cálculo em tempo real */}
                                {(formPallets > 0 || formLoose > 0) && (
                                  <div className={`rounded-lg p-4 ${lossNegative ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <div className="text-gray-500">Peças em pallets</div>
                                        <div className="text-lg font-bold text-green-600">{fmtInt(realPieces)}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Peças soltas</div>
                                        <div className="text-lg font-bold text-purple-600">{fmtInt(formLoose)}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Perda</div>
                                        <div className={`text-lg font-bold ${
                                          lossNegative ? 'text-red-600' : lossPieces === 0 ? 'text-green-600' : 'text-amber-600'
                                        }`}>
                                          {fmtInt(lossPieces)} pçs
                                          {!lossNegative && totalDisponivel > 0 && (
                                            <span className="text-sm font-normal ml-1">
                                              ({fmtDec(lossPct, 1)}%)
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {lossNegative && (
                                      <div className="mt-2 text-sm text-red-600 font-medium">
                                        Erro: a soma de pallets + soltas ultrapassa o disponível ({fmtInt(totalDisponivel)} pçs)
                                      </div>
                                    )}
                                  </div>
                                )}

                                {error && (
                                  <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                                    {error}
                                  </div>
                                )}

                                {/* Botões */}
                                <div className="flex justify-end gap-3">
                                  <button
                                    onClick={() => setExpandedRow(null)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => handleSavePalletization(item)}
                                    disabled={saving || lossNegative || (formPallets === 0 && formLoose === 0)}
                                    className="px-6 py-2 bg-[#2d3e7e] text-white rounded-lg hover:bg-[#243269] disabled:opacity-50 transition-colors font-medium text-sm"
                                  >
                                    {saving ? 'Salvando...' : 'Confirmar Paletização'}
                                  </button>
                                </div>
                              </div>
                            </div>
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
        </>
      )}

      {/* Tab Histórico */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma paletização registrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Palet.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Prod.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Teórico</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pallets</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Real (pçs)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Perda</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => {
                    const totalDisponivel = item.theoreticalPieces + item.loosePiecesBefore
                    const lossPct = totalDisponivel > 0 ? (item.lossPieces / totalDisponivel) * 100 : 0
                    const lossColor = lossPct < 3 ? 'bg-green-100 text-green-700' : lossPct < 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                          {new Date(item.palletizedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-gray-500">
                          {new Date(item.productionDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                          {item.productName}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">
                          {fmtInt(item.theoreticalPieces)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right font-semibold text-indigo-600">
                          {fmtInt(item.completePallets)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-green-600">
                          {fmtInt(item.realPieces)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          {item.lossPieces > 0 ? (
                            <span className="text-red-600">{fmtInt(item.lossPieces)}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${lossColor}`}>
                            {fmtDec(lossPct, 1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeletePalletization(item.id)}
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

      {/* Tab Peças Soltas */}
      {activeTab === 'loose' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loose.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma peça solta acumulada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peças Soltas</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pçs/Pallet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progresso</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loose.map((item) => {
                    const progress = Math.min((item.pieces / item.piecesPerPallet) * 100, 100)
                    const canForm = item.pieces >= item.piecesPerPallet
                    const faltam = Math.max(0, item.piecesPerPallet - item.pieces)

                    return (
                      <tr key={item.productId}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {item.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-purple-600">
                          {fmtInt(item.pieces)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                          {fmtInt(item.piecesPerPallet)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  canForm ? 'bg-green-500' : 'bg-purple-400'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap min-w-[80px] text-right">
                              {canForm
                                ? 'Pallet completo!'
                                : `Faltam ${fmtInt(faltam)}`
                              }
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleFormPallet(item.productId)}
                            disabled={!canForm}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              canForm
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            Formar Pallet
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
    </div>
  )
}
