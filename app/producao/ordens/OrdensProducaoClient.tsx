'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmtInt, fmtProductionOrderNumber, fmtOrderNumber } from '@/lib/format'
import {
  getProductionOrdersPaginated,
  getProductionOrderKPIs,
  cancelProductionOrder,
  cancelAllForOrder,
  type ProductionOrderPaginationParams,
  type ProductionOrderKPIs,
} from '@/app/actions/production-orders'

// ===== Tipos =====

interface OPRow {
  id: string
  number: number
  orderId: string
  orderNumber: number
  customerName: string
  productId: string
  productName: string
  quantityPieces: number
  stockAtCreation: number
  toProducePieces: number
  currentStock: number
  status: string
  notes: string | null
  completedAt: string | null
  createdAt: string
}

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Progresso',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  const color = pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">{Math.round(pct)}%</span>
    </div>
  )
}

// ===== Componente Principal =====

interface PaginatedData {
  data: OPRow[]
  total: number
  page: number
  totalPages: number
}

interface OrdensProducaoClientProps {
  initialData: PaginatedData
  initialKPIs: ProductionOrderKPIs
  initialOrderId: string
}

export function OrdensProducaoClient({ initialData, initialKPIs, initialOrderId }: OrdensProducaoClientProps) {
  const [ops, setOps] = useState<OPRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [kpis, setKpis] = useState<ProductionOrderKPIs>(initialKPIs)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [orderIdFilter, setOrderIdFilter] = useState(initialOrderId)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Ordenação
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // UI
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
      const params: ProductionOrderPaginationParams = {
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        orderId: orderIdFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }
      const result = await getProductionOrdersPaginated(params)
      setOps(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, orderIdFilter, dateFrom, dateTo, sortBy, sortOrder])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, orderIdFilter, dateFrom, dateTo, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    await Promise.all([fetchData(page), getProductionOrderKPIs().then(setKpis)])
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
      setSortOrder(field === 'number' || field === 'createdAt' ? 'desc' : 'asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // Ações
  const handleCancel = async (op: OPRow) => {
    if (!confirm(`Cancelar ordem ${fmtProductionOrderNumber(op.number)}?`)) return
    try {
      await cancelProductionOrder(op.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar')
    }
  }

  const handleCancelAll = async (op: OPRow) => {
    if (!confirm(`Cancelar TODAS as ordens do pedido ${fmtOrderNumber(op.orderNumber)}? O pedido voltará para "Confirmado".`)) return
    try {
      await cancelAllForOrder(op.orderId)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar')
    }
  }

  // Paginação
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Produção</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe o andamento das ordens geradas a partir dos pedidos
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pendentes</div>
          <div className="text-3xl font-bold text-amber-600">{kpis.pending}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Em Progresso</div>
          <div className="text-3xl font-bold text-blue-600">{kpis.inProgress}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Concluídas</div>
          <div className="text-3xl font-bold text-green-600">{kpis.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Peças Pendentes</div>
          <div className="text-3xl font-bold text-gray-700">{fmtInt(kpis.pendingPieces)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nº OP, pedido, produto..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pedido</label>
            <input
              type="text"
              value={orderIdFilter}
              onChange={(e) => setOrderIdFilter(e.target.value)}
              placeholder="ID do pedido"
              className={orderIdFilter ? 'border-blue-300' : ''}
            />
            {orderIdFilter && (
              <button
                onClick={() => setOrderIdFilter('')}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                Limpar filtro de pedido
              </button>
            )}
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
        {ops.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {kpis.total === 0
              ? 'Nenhuma ordem de produção cadastrada'
              : 'Nenhuma ordem encontrada com os filtros aplicados'}
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
                      N° <SortIndicator field="number" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('order')}
                    >
                      Pedido <SortIndicator field="order" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('product')}
                    >
                      Produto <SortIndicator field="product" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Solicitado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Estoque
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      A Produzir
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Progresso
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIndicator field="status" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ops.map((op) => (
                    <tr key={op.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {fmtProductionOrderNumber(op.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#3bbfb5] font-medium">
                        {fmtOrderNumber(op.orderNumber)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 max-w-[200px] truncate">
                        {op.customerName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {op.productName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                        {fmtInt(op.quantityPieces)} pç
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                        {fmtInt(op.currentStock)} pç
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                        {fmtInt(op.toProducePieces)} pç
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <ProgressBar current={op.currentStock} total={op.quantityPieces} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[op.status]}`}>
                          {STATUS_LABELS[op.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(op.status === 'PENDING' || op.status === 'IN_PROGRESS') && (
                            <>
                              <button
                                onClick={() => handleCancel(op)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium px-1"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleCancelAll(op)}
                                className="text-red-400 hover:text-red-600 text-xs font-medium px-1"
                                title={`Cancelar todas as OPs do pedido ${fmtOrderNumber(op.orderNumber)}`}
                              >
                                Cancelar Todas
                              </button>
                            </>
                          )}
                          {op.status === 'COMPLETED' && (
                            <span className="text-green-600 text-xs">Concluída</span>
                          )}
                          {op.status === 'CANCELLED' && (
                            <span className="text-gray-400 text-xs">-</span>
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
                  Mostrando {startItem} a {endItem} de {total} ordens
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
    </div>
  )
}
