'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmtMoney, fmtOrderNumber, fmtQuoteNumber, fmtMax, fmtInt, fmtProductionOrderNumber } from '@/lib/format'
import {
  getOrdersPaginated,
  getOrderKPIs,
  createStandaloneOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  type OrderPaginationParams,
  type OrderKPIs,
} from '@/app/actions/orders'
import {
  getStockCheckForOrder,
  generateProductionOrders,
  type StockCheckItem,
} from '@/app/actions/production-orders'
import type { OrderStatus } from '@/app/generated/prisma/client'

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
}

interface OrderRow {
  id: string
  number: number
  orderDate: string
  deliveryDate: string | null
  status: string
  totalAmount: number
  quoteId: string | null
  customer: { id: string; companyName: string; tradeName: string | null }
  quote: { number: number } | null
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
  CONFIRMED: 'Confirmado',
  IN_PRODUCTION: 'Em Produção',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PRODUCTION: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const STATUS_STEPS = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function newItemKey() {
  return Math.random().toString(36).slice(2, 9)
}

// ===== Componente de Barra de Progresso =====

function StatusProgress({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return <span className="text-xs text-red-600 font-medium">Cancelado</span>
  }

  const currentIdx = STATUS_STEPS.indexOf(status)

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              idx <= currentIdx ? 'bg-[#3bbfb5]' : 'bg-gray-200'
            }`}
            title={STATUS_LABELS[step]}
          />
          {idx < STATUS_STEPS.length - 1 && (
            <div
              className={`w-4 h-0.5 ${
                idx < currentIdx ? 'bg-[#3bbfb5]' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ===== Componente Principal =====

interface PaginatedData {
  data: OrderRow[]
  total: number
  page: number
  totalPages: number
}

interface PedidosClientProps {
  initialData: PaginatedData
  initialKPIs: OrderKPIs
  customers: CustomerOption[]
  products: ProductOption[]
}

export function PedidosClient({ initialData, initialKPIs, customers, products }: PedidosClientProps) {
  // Dados paginados
  const [orders, setOrders] = useState<OrderRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [kpis, setKpis] = useState<OrderKPIs>(initialKPIs)

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
  const [formDeliveryDate, setFormDeliveryDate] = useState('')
  const [formPaymentTerms, setFormPaymentTerms] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formItems, setFormItems] = useState<FormItem[]>([])

  // Modal Gerar OPs
  const [showOPModal, setShowOPModal] = useState(false)
  const [opModalOrderId, setOpModalOrderId] = useState<string | null>(null)
  const [opModalOrderNumber, setOpModalOrderNumber] = useState(0)
  const [opModalCustomerName, setOpModalCustomerName] = useState('')
  const [opStockCheck, setOpStockCheck] = useState<StockCheckItem[]>([])
  const [opToProduceEdits, setOpToProduceEdits] = useState<Record<string, number>>({})
  const [opLoading, setOpLoading] = useState(false)
  const [opSaving, setOpSaving] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)

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
      const params: OrderPaginationParams = {
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
      const result = await getOrdersPaginated(params)
      setOrders(result.data)
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
    await Promise.all([fetchData(page), getOrderKPIs().then(setKpis)])
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
      setSortOrder(field === 'number' || field === 'orderDate' || field === 'totalAmount' ? 'desc' : 'asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // ===== Formulário =====

  const handleNew = () => {
    setEditingId(null)
    setFormCustomerId('')
    setFormDeliveryDate('')
    setFormPaymentTerms('')
    setFormNotes('')
    setFormItems([{ key: newItemKey(), productId: '', quantity: 0, unit: 'M2', unitPrice: 0, discount: 0 }])
    setError(null)
    setShowForm(true)
  }

  const handleEdit = async (o: OrderRow) => {
    const { getOrderById } = await import('@/app/actions/orders')
    const detail = await getOrderById(o.id)

    setEditingId(o.id)
    setFormCustomerId(detail.customerId)
    setFormDeliveryDate(detail.deliveryDate ? detail.deliveryDate.split('T')[0] : '')
    setFormPaymentTerms(detail.paymentTerms || '')
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
        deliveryDate: formDeliveryDate,
        paymentTerms: formPaymentTerms,
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
        await updateOrder(editingId, data)
      } else {
        await createStandaloneOrder(data)
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
      await updateOrderStatus(id, newStatus as OrderStatus)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  const handleDelete = async (o: OrderRow) => {
    if (!confirm(`Excluir pedido ${fmtOrderNumber(o.number)}?`)) return
    try {
      await deleteOrder(o.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  // ===== Modal Gerar OPs =====

  const handleOpenOPModal = async (o: OrderRow) => {
    setOpModalOrderId(o.id)
    setOpModalOrderNumber(o.number)
    setOpModalCustomerName(o.customer.tradeName || o.customer.companyName)
    setOpError(null)
    setOpLoading(true)
    setShowOPModal(true)

    try {
      const check = await getStockCheckForOrder(o.id)
      setOpStockCheck(check)
      // Pré-preencher campos editáveis
      const edits: Record<string, number> = {}
      for (const item of check) {
        edits[item.orderItemId] = item.suggestedToProduce
      }
      setOpToProduceEdits(edits)
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erro ao verificar estoque')
    } finally {
      setOpLoading(false)
    }
  }

  const handleCloseOPModal = () => {
    setShowOPModal(false)
    setOpModalOrderId(null)
    setOpStockCheck([])
    setOpToProduceEdits({})
    setOpError(null)
  }

  const handleGenerateOPs = async () => {
    if (!opModalOrderId) return
    setOpSaving(true)
    setOpError(null)

    try {
      await generateProductionOrders({
        orderId: opModalOrderId,
        items: opStockCheck.map((item) => ({
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantityPieces: item.quantityPieces,
          toProducePieces: opToProduceEdits[item.orderItemId] ?? item.suggestedToProduce,
        })),
      })
      handleCloseOPModal()
      await refreshAll()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Erro ao gerar ordens')
    } finally {
      setOpSaving(false)
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
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Novo Pedido Avulso
        </button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-3xl font-bold text-gray-900">{kpis.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Confirmados</div>
          <div className="text-3xl font-bold text-blue-600">{kpis.confirmed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Em Produção</div>
          <div className="text-3xl font-bold text-amber-600">{kpis.inProduction}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Prontos</div>
          <div className="text-3xl font-bold text-green-600">{kpis.ready}</div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Pedido' : 'Novo Pedido Avulso'}
          </h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Prev. Entrega</label>
                <input
                  type="date"
                  value={formDeliveryDate}
                  onChange={(e) => setFormDeliveryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cond. Pagamento</label>
                <input
                  type="text"
                  value={formPaymentTerms}
                  onChange={(e) => setFormPaymentTerms(e.target.value)}
                  placeholder="Ex: 30/60/90 dias"
                />
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
                      </div>

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
                placeholder="Observações do pedido..."
                className="w-full"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Pedido'}
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
              <option value="CONFIRMED">Confirmado</option>
              <option value="IN_PRODUCTION">Em Produção</option>
              <option value="READY">Pronto</option>
              <option value="DELIVERED">Entregue</option>
              <option value="CANCELLED">Cancelado</option>
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
        {orders.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {kpis.total === 0
              ? 'Nenhum pedido cadastrado'
              : 'Nenhum pedido encontrado com os filtros aplicados'}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Origem
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('customer')}
                    >
                      Cliente <SortIndicator field="customer" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('orderDate')}
                    >
                      Data <SortIndicator field="orderDate" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('deliveryDate')}
                    >
                      Prev. Entrega <SortIndicator field="deliveryDate" />
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIndicator field="status" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Progresso
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
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {fmtOrderNumber(o.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-sm">
                        {o.quote ? (
                          <span className="text-[#3bbfb5]">{fmtQuoteNumber(o.quote.number)}</span>
                        ) : (
                          <span className="text-gray-400">Avulso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {o.customer.tradeName || o.customer.companyName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(o.orderDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {o.deliveryDate ? formatDate(o.deliveryDate) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <StatusProgress status={o.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        {fmtMoney(o.totalAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {o.status === 'CONFIRMED' && (
                            <>
                              <button
                                onClick={() => handleEdit(o)}
                                className="text-[#2d3e7e] hover:text-[#1e2d5e] text-xs font-medium px-1"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleOpenOPModal(o)}
                                className="text-amber-600 hover:text-amber-800 text-xs font-medium px-1"
                              >
                                Gerar Ordens
                              </button>
                              <button
                                onClick={() => handleDelete(o)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                          {o.status === 'IN_PRODUCTION' && (
                            <a
                              href={`/producao/ordens?orderId=${o.id}`}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                            >
                              Ver Ordens
                            </a>
                          )}
                          {o.status === 'READY' && (
                            <>
                              <a
                                href="/logistica/entregas"
                                className="text-teal-600 hover:text-teal-800 text-xs font-medium px-1"
                              >
                                Criar Entrega
                              </a>
                              <a
                                href={`/producao/ordens?orderId=${o.id}`}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                              >
                                Ver Ordens
                              </a>
                            </>
                          )}
                          {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                if (confirm(`Cancelar pedido ${fmtOrderNumber(o.number)}?`)) {
                                  handleStatusChange(o.id, 'CANCELLED')
                                }
                              }}
                              className="text-red-500 hover:text-red-700 text-xs font-medium px-1"
                            >
                              Cancelar
                            </button>
                          )}
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
                  Mostrando {startItem} a {endItem} de {total} pedidos
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

      {/* Modal Gerar Ordens de Produção */}
      {showOPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Gerar Ordens de Produção — {fmtOrderNumber(opModalOrderNumber)}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Cliente: {opModalCustomerName}
              </p>

              {opError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
                  {opError}
                </div>
              )}

              {opLoading ? (
                <div className="py-8 text-center text-gray-500">Verificando estoque...</div>
              ) : (
                <>
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pedido</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Produzir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {opStockCheck.map((item) => {
                          const toProduce = opToProduceEdits[item.orderItemId] ?? item.suggestedToProduce
                          const fullyCovered = item.availableStock >= item.quantityPieces && item.reservedByOthers === 0

                          return (
                            <tr key={item.orderItemId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{item.productName}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                {fmtInt(item.quantityPieces)} pç
                                {item.unit === 'M2' && (
                                  <span className="text-xs text-gray-400 block">
                                    ({fmtMax(item.quantityOrdered, 2)} m²)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                <span className={item.availableStock > 0 ? 'text-green-600' : 'text-gray-500'}>
                                  {fmtInt(item.availableStock)} pç
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {fullyCovered ? (
                                  <span className="text-green-600 text-sm font-medium">0 pç</span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.quantityPieces}
                                      value={toProduce}
                                      onChange={(e) =>
                                        setOpToProduceEdits({
                                          ...opToProduceEdits,
                                          [item.orderItemId]: Math.max(0, parseInt(e.target.value) || 0),
                                        })
                                      }
                                      className="w-24 text-right text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <span className="text-xs text-gray-500">pç</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Avisos */}
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-blue-600 flex items-start gap-1">
                      <span className="shrink-0">i</span>
                      <span>Estoque disponível será abatido da quantidade a produzir.</span>
                    </p>
                    {opStockCheck
                      .filter((item) => item.reservedByOthers > 0)
                      .map((item) => (
                        <p key={item.orderItemId} className="text-sm text-amber-600 flex items-start gap-1">
                          <span className="shrink-0">!</span>
                          <span>
                            {item.productName}: {fmtInt(item.reservedByOthers)} pç já reservadas para outros pedidos
                            ({item.reservedDetails.map((d) => fmtProductionOrderNumber(d.opNumber)).join(', ')}).
                          </span>
                        </p>
                      ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleCloseOPModal}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleGenerateOPs}
                      disabled={opSaving}
                      className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
                    >
                      {opSaving ? 'Gerando...' : 'Gerar Ordens'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
