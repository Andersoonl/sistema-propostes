'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmtMoney, fmtQuoteNumber, fmtMax } from '@/lib/format'
import {
  getQuotesPaginated,
  getQuoteKPIs,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  duplicateQuote,
  convertQuoteToOrder,
  type QuotePaginationParams,
  type QuoteKPIs,
} from '@/app/actions/quotes'
import type { QuoteStatus } from '@/app/generated/prisma/client'

// ===== Tipos locais =====

interface CustomerOption {
  id: string
  companyName: string
  tradeName: string | null
}

interface ProductOption {
  id: string
  name: string
  category: string | null
  piecesPerM2: number | null
  basePrice: number | null
  basePriceUnit: string | null
}

interface QuoteRow {
  id: string
  number: number
  date: string
  validUntil: string
  status: string
  totalAmount: number
  customer: { id: string; companyName: string; tradeName: string | null }
  _count: { items: number }
}

interface FormItem {
  key: string
  productId: string
  quantity: number
  unit: 'PIECES' | 'M2'
  unitPrice: number
  discount: number
}

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  EXPIRED: 'Expirado',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function newItemKey() {
  return Math.random().toString(36).slice(2, 9)
}

// ===== Componente Principal =====

interface PaginatedData {
  data: QuoteRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface OrcamentosClientProps {
  initialData: PaginatedData
  initialKPIs: QuoteKPIs
  customers: CustomerOption[]
  products: ProductOption[]
}

export function OrcamentosClient({ initialData, initialKPIs, customers, products }: OrcamentosClientProps) {
  // Dados paginados
  const [quotes, setQuotes] = useState<QuoteRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [kpis, setKpis] = useState<QuoteKPIs>(initialKPIs)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [customerFilter, setCustomerFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Ordenação
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Formulário
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formValidUntil, setFormValidUntil] = useState('')
  const [formProjectName, setFormProjectName] = useState('')
  const [formPaymentTerms, setFormPaymentTerms] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState('')
  const [formDeliveryType, setFormDeliveryType] = useState('CIF')
  const [formDeliveryAddress, setFormDeliveryAddress] = useState('')
  const [formDeliverySchedule, setFormDeliverySchedule] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formItems, setFormItems] = useState<FormItem[]>([])

  // Modal de conversão
  const [convertingQuote, setConvertingQuote] = useState<QuoteRow | null>(null)

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isFirstRender = useRef(true)

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch
  const fetchData = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const params: QuotePaginationParams = {
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        customerId: customerFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }
      const result = await getQuotesPaginated(params)
      setQuotes(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, customerFilter, dateFrom, dateTo, sortBy, sortOrder])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, customerFilter, dateFrom, dateTo, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    await Promise.all([fetchData(page), getQuoteKPIs().then(setKpis)])
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy(null)
        setSortOrder('desc')
      }
    } else {
      setSortBy(field)
      setSortOrder(field === 'number' || field === 'date' || field === 'totalAmount' ? 'desc' : 'asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // ===== Formulário =====

  const defaultValidUntil = () => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }

  const handleNew = () => {
    setEditingId(null)
    setFormCustomerId('')
    setFormValidUntil(defaultValidUntil())
    setFormProjectName('')
    setFormPaymentTerms('')
    setFormPaymentMethod('')
    setFormDeliveryType('CIF')
    setFormDeliveryAddress('')
    setFormDeliverySchedule('')
    setFormNotes('')
    setFormItems([{ key: newItemKey(), productId: '', quantity: 0, unit: 'M2', unitPrice: 0, discount: 0 }])
    setError(null)
    setShowForm(true)
  }

  const handleEdit = async (q: QuoteRow) => {
    // Carregar detalhe completo
    const { getQuoteById } = await import('@/app/actions/quotes')
    const detail = await getQuoteById(q.id)

    setEditingId(q.id)
    setFormCustomerId(detail.customerId)
    setFormValidUntil(detail.validUntil.split('T')[0])
    setFormProjectName(detail.projectName || '')
    setFormPaymentTerms(detail.paymentTerms || '')
    setFormPaymentMethod(detail.paymentMethod || '')
    setFormDeliveryType(detail.deliveryType || 'CIF')
    setFormDeliveryAddress(detail.deliveryAddress || '')
    setFormDeliverySchedule(detail.deliverySchedule || '')
    setFormNotes(detail.notes || '')
    setFormItems(
      detail.items.map((item: { productId: string; quantity: number; unit: string; unitPrice: number; discount?: number }) => ({
        key: newItemKey(),
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit as 'PIECES' | 'M2',
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
      }))
    )
    setError(null)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleAddItem = () => {
    setFormItems([...formItems, { key: newItemKey(), productId: '', quantity: 0, unit: 'M2', unitPrice: 0, discount: 0 }])
  }

  const handleRemoveItem = (key: string) => {
    if (formItems.length <= 1) return
    setFormItems(formItems.filter((i) => i.key !== key))
  }

  const handleItemChange = (key: string, field: keyof FormItem, value: string | number) => {
    setFormItems(
      formItems.map((item) => {
        if (item.key !== key) return item
        const updated = { ...item, [field]: value }

        // Ao selecionar produto, auto-preencher preço base se disponível
        if (field === 'productId' && value) {
          const product = products.find((p) => p.id === value)
          if (product?.basePrice) {
            const itemUnit = updated.unit
            if (product.basePriceUnit === itemUnit || !product.piecesPerM2) {
              updated.unitPrice = product.basePrice
            } else if (product.piecesPerM2) {
              // Converter preço: base é por m² e item é por peça (ou vice-versa)
              if (product.basePriceUnit === 'M2' && itemUnit === 'PIECES') {
                updated.unitPrice = product.basePrice / product.piecesPerM2
              } else if (product.basePriceUnit === 'PIECES' && itemUnit === 'M2') {
                updated.unitPrice = product.basePrice * product.piecesPerM2
              }
            }
          }
        }

        // Ao trocar unidade, converter quantidade e preço para manter subtotal
        if (field === 'unit') {
          const product = products.find((p) => p.id === item.productId)
          if (product?.piecesPerM2 && item.quantity > 0) {
            const subtotal = item.quantity * item.unitPrice
            if (value === 'M2' && item.unit === 'PIECES') {
              updated.quantity = item.quantity / product.piecesPerM2
              updated.unitPrice = subtotal / updated.quantity
            } else if (value === 'PIECES' && item.unit === 'M2') {
              updated.quantity = item.quantity * product.piecesPerM2
              updated.unitPrice = subtotal / updated.quantity
            }
          }
        }

        return updated
      })
    )
  }

  const getItemSubtotal = (item: FormItem) => item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100)
  const getFormTotal = () => formItems.reduce((sum, item) => sum + getItemSubtotal(item), 0)

  const getPriceHint = (item: FormItem) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product?.basePrice) return null
    const unitLabel = product.basePriceUnit === 'PIECES' ? 'pç' : 'm²'
    return `Base: R$ ${product.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/${unitLabel}`
  }

  const getUnitHelper = (item: FormItem) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product?.piecesPerM2 || item.quantity <= 0) return null

    if (item.unit === 'PIECES') {
      const m2 = item.quantity / product.piecesPerM2
      return `= ${fmtMax(m2, 2)} m²`
    } else {
      const pieces = item.quantity * product.piecesPerM2
      return `= ${fmtMax(pieces, 0)} peças`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const data = {
        customerId: formCustomerId,
        validUntil: formValidUntil,
        projectName: formProjectName,
        paymentTerms: formPaymentTerms,
        paymentMethod: formPaymentMethod,
        deliveryType: formDeliveryType,
        deliveryAddress: formDeliveryAddress,
        deliverySchedule: formDeliverySchedule,
        notes: formNotes,
        items: formItems.map(({ productId, quantity, unit, unitPrice, discount }) => ({
          productId,
          quantity,
          unit,
          unitPrice,
          discount,
        })),
      }

      if (editingId) {
        await updateQuote(editingId, data)
      } else {
        await createQuote(data)
      }

      setShowForm(false)
      setEditingId(null)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ===== Ações =====

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateQuoteStatus(id, newStatus as QuoteStatus)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  const handleDelete = async (q: QuoteRow) => {
    if (!confirm(`Excluir orçamento ${fmtQuoteNumber(q.number)}?`)) return
    try {
      await deleteQuote(q.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateQuote(id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao duplicar')
    }
  }

  const handleConvertConfirm = async () => {
    if (!convertingQuote) return
    try {
      await convertQuoteToOrder(convertingQuote.id)
      setConvertingQuote(null)
      await refreshAll()
      alert('Pedido criado com sucesso!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao converter')
    }
  }

  // Paginação
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  // Agrupar produtos por categoria
  const productsByCategory = products.reduce<Record<string, ProductOption[]>>((acc, p) => {
    const cat = p.category || 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Novo Orçamento
        </button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-3xl font-bold text-gray-900">{kpis.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Rascunhos</div>
          <div className="text-3xl font-bold text-gray-500">{kpis.drafts}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Aprovados</div>
          <div className="text-3xl font-bold text-green-600">{kpis.approved}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Valor Aprovado</div>
          <div className="text-2xl font-bold text-[#2d3e7e]">{fmtMoney(kpis.approvedValue)}</div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados gerais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName || c.companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validade *</label>
                <input
                  type="date"
                  value={formValidUntil}
                  onChange={(e) => setFormValidUntil(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Obra / Projeto</label>
                <input
                  type="text"
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value)}
                  placeholder="Nome da obra ou projeto"
                />
              </div>
            </div>

            {/* Entrega e Logística */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">Entrega e Logística</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Frete</label>
                  <select
                    value={formDeliveryType}
                    onChange={(e) => setFormDeliveryType(e.target.value)}
                  >
                    <option value="CIF">CIF - Entrega no cliente</option>
                    <option value="FOB">FOB - Cliente retira</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Programação de Entrega</label>
                  <input
                    type="text"
                    value={formDeliverySchedule}
                    onChange={(e) => setFormDeliverySchedule(e.target.value)}
                    placeholder="Ex: Imediata, 5 dias úteis"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Entrega</label>
                  <input
                    type="text"
                    value={formDeliveryAddress}
                    onChange={(e) => setFormDeliveryAddress(e.target.value)}
                    placeholder="Endereço da obra"
                  />
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">Pagamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Pagamento</label>
                  <input
                    type="text"
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                    placeholder="Ex: 15 dias, 30/60/90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <input
                    type="text"
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    placeholder="Ex: Boleto, PIX, Transferência"
                  />
                </div>
              </div>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider">Itens</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-sm text-[#3bbfb5] hover:text-[#2ea69d] font-medium"
                >
                  + Adicionar Item
                </button>
              </div>
              <div className="space-y-3">
                {formItems.map((item) => {
                  const product = products.find((p) => p.id === item.productId)
                  const canToggleUnit = product?.piecesPerM2 != null

                  return (
                    <div key={item.key} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-3 rounded-lg">
                      {/* Produto */}
                      <div className="col-span-12 md:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Produto *</label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(item.key, 'productId', e.target.value)}
                          required
                        >
                          <option value="">Selecione...</option>
                          {Object.entries(productsByCategory).map(([cat, prods]) => (
                            <optgroup key={cat} label={cat}>
                              {prods.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Qtd *</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(item.key, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                        />
                        {getUnitHelper(item) && (
                          <p className="text-xs text-gray-400 mt-0.5">{getUnitHelper(item)}</p>
                        )}
                      </div>

                      {/* Unidade */}
                      <div className="col-span-4 md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Unid.</label>
                        {canToggleUnit ? (
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(item.key, 'unit', e.target.value)}
                          >
                            <option value="M2">m²</option>
                            <option value="PIECES">Peças</option>
                          </select>
                        ) : (
                          <select value="PIECES" disabled>
                            <option value="PIECES">Peças</option>
                          </select>
                        )}
                      </div>

                      {/* Preço unitário */}
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Preço Unit. (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice || ''}
                          onChange={(e) => handleItemChange(item.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                          required
                        />
                        {getPriceHint(item) && (
                          <p className="text-xs text-blue-500 mt-0.5">{getPriceHint(item)}</p>
                        )}
                      </div>

                      {/* Desconto */}
                      <div className="col-span-3 md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Desc. %</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.discount || ''}
                          onChange={(e) => handleItemChange(item.key, 'discount', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="col-span-5 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Subtotal</label>
                        <div className="py-2 text-sm font-medium text-gray-700">
                          {item.discount > 0 && (
                            <span className="text-xs text-gray-400 line-through mr-1">
                              {fmtMoney(item.quantity * item.unitPrice)}
                            </span>
                          )}
                          {fmtMoney(getItemSubtotal(item))}
                        </div>
                      </div>

                      {/* Remover */}
                      <div className="col-span-4 md:col-span-1 flex items-end pb-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.key)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          disabled={formItems.length <= 1}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <span className="text-sm text-gray-500">Total: </span>
                  <span className="text-xl font-bold text-[#2d3e7e]">{fmtMoney(getFormTotal())}</span>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Observações do orçamento..."
                className="w-full"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Orçamento'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nº, cliente..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SENT">Enviado</option>
              <option value="APPROVED">Aprovado</option>
              <option value="REJECTED">Recusado</option>
              <option value="EXPIRED">Expirado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="">Todos</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tradeName || c.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Até</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="px-6 py-2 bg-blue-50 text-blue-600 text-sm">Carregando...</div>
        )}
        {quotes.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {kpis.total === 0
              ? 'Nenhum orçamento cadastrado'
              : 'Nenhum orçamento encontrado com os filtros aplicados'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('number')}
                    >
                      Nº <SortIndicator field="number" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('customer')}
                    >
                      Cliente <SortIndicator field="customer" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('date')}
                    >
                      Data <SortIndicator field="date" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('validUntil')}
                    >
                      Validade <SortIndicator field="validUntil" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIndicator field="status" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('totalAmount')}
                    >
                      Valor <SortIndicator field="totalAmount" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {fmtQuoteNumber(q.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {q.customer.tradeName || q.customer.companyName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(q.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(q.validUntil)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status]}`}>
                          {STATUS_LABELS[q.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        {fmtMoney(q.totalAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {q.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleEdit(q)}
                                className="text-[#2d3e7e] hover:text-[#1e2d5e] text-xs font-medium px-1"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleStatusChange(q.id, 'SENT')}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                              >
                                Enviar
                              </button>
                              <button
                                onClick={() => handleDelete(q)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                          {q.status === 'SENT' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(q.id, 'APPROVED')}
                                className="text-green-600 hover:text-green-800 text-xs font-medium px-1"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleStatusChange(q.id, 'REJECTED')}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                              >
                                Recusar
                              </button>
                            </>
                          )}
                          {q.status === 'APPROVED' && (
                            <button
                              onClick={() => setConvertingQuote(q)}
                              className="text-[#3bbfb5] hover:text-[#2ea69d] text-xs font-medium px-1"
                            >
                              Gerar Pedido
                            </button>
                          )}
                          <button
                            onClick={() => window.open(`/api/quotes/${q.id}/pdf`, '_blank')}
                            className="text-[#2d3e7e] hover:text-[#1e2d5e] text-xs font-medium px-1"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDuplicate(q.id)}
                            className="text-gray-500 hover:text-gray-700 text-xs font-medium px-1"
                          >
                            Duplicar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                <span>
                  Mostrando {startItem} a {endItem} de {total} orçamentos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchData(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span>Página {page} de {totalPages}</span>
                  <button
                    onClick={() => fetchData(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de conversão em pedido */}
      {convertingQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Converter em Pedido</h3>
            <div className="space-y-2 mb-6 text-sm text-gray-600">
              <p><strong>Orçamento:</strong> {fmtQuoteNumber(convertingQuote.number)}</p>
              <p><strong>Cliente:</strong> {convertingQuote.customer.tradeName || convertingQuote.customer.companyName}</p>
              <p><strong>Valor:</strong> {fmtMoney(convertingQuote.totalAmount)}</p>
              <p><strong>Itens:</strong> {convertingQuote._count.items}</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Um novo pedido será criado com os mesmos itens e valores deste orçamento.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConvertingQuote(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertConfirm}
                className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
