'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmtDeliveryNumber, fmtOrderNumber, fmtInt } from '@/lib/format'
import {
  getDeliveriesPaginated,
  getDeliveryKPIs,
  getDeliveryCheckForOrder,
  getDeliveryAddress,
  getReadyOrders,
  createDelivery,
  updateDeliveryStatus,
  deleteDelivery,
  type DeliveryPaginationParams,
  type DeliveryKPIs,
  type DeliveryCheckItem,
} from '@/app/actions/deliveries'
import { getAllActiveVehicles } from '@/app/actions/vehicles'
import { getAllActiveDrivers } from '@/app/actions/drivers'
import type { DeliveryStatus } from '@/app/generated/prisma/client'

// ===== Tipos locais =====

interface VehicleOption {
  id: string
  plate: string
  description: string | null
}

interface DriverOption {
  id: string
  name: string
}

interface OrderOption {
  id: string
  number: number
  customer: { companyName: string; tradeName: string | null }
}

interface DeliveryRow {
  id: string
  number: number
  orderId: string
  loadingDate: string
  deliveryDate: string | null
  deliveryAddress: string | null
  status: string
  notes: string | null
  order: {
    number: number
    customer: { companyName: string; tradeName: string | null }
  }
  vehicle: { plate: string; description: string | null } | null
  driver: { name: string } | null
  _count: { items: number }
}

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  LOADING: 'Carregando',
  IN_TRANSIT: 'Em Trânsito',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  LOADING: 'bg-amber-100 text-amber-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatPlate(plate: string) {
  if (plate.length === 7) {
    return `${plate.slice(0, 3)}-${plate.slice(3)}`
  }
  return plate
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ===== Componente =====

interface PaginatedData {
  data: DeliveryRow[]
  total: number
  page: number
  totalPages: number
}

interface EntregasClientProps {
  initialData: PaginatedData
  initialKPIs: DeliveryKPIs
  readyOrders: OrderOption[]
  vehicles: VehicleOption[]
  drivers: DriverOption[]
}

export function EntregasClient({ initialData, initialKPIs, readyOrders: initialReadyOrders, vehicles: initialVehicles, drivers: initialDrivers }: EntregasClientProps) {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [kpis, setKpis] = useState<DeliveryKPIs>(initialKPIs)

  // Listas para dropdowns
  const [readyOrders, setReadyOrders] = useState<OrderOption[]>(initialReadyOrders)
  const [vehicles, setVehicles] = useState<VehicleOption[]>(initialVehicles)
  const [drivers, setDrivers] = useState<DriverOption[]>(initialDrivers)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Ordenação
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modal Nova Entrega
  const [showModal, setShowModal] = useState(false)
  const [modalOrderId, setModalOrderId] = useState('')
  const [modalVehicleId, setModalVehicleId] = useState('')
  const [modalDriverId, setModalDriverId] = useState('')
  const [modalLoadingDate, setModalLoadingDate] = useState(todayStr())
  const [modalAddress, setModalAddress] = useState('')
  const [modalNotes, setModalNotes] = useState('')
  const [modalItems, setModalItems] = useState<DeliveryCheckItem[]>([])
  const [modalQtyEdits, setModalQtyEdits] = useState<Record<string, number>>({})
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

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
      const params: DeliveryPaginationParams = {
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        vehicleId: vehicleFilter || undefined,
        driverId: driverFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }
      const result = await getDeliveriesPaginated(params)
      setDeliveries(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, vehicleFilter, driverFilter, dateFrom, dateTo, sortBy, sortOrder])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, vehicleFilter, driverFilter, dateFrom, dateTo, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    const [, newKpis, newOrders, newVehicles, newDrivers] = await Promise.all([
      fetchData(page),
      getDeliveryKPIs(),
      getReadyOrders(),
      getAllActiveVehicles(),
      getAllActiveDrivers(),
    ])
    setKpis(newKpis)
    setReadyOrders(newOrders)
    setVehicles(newVehicles)
    setDrivers(newDrivers)
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
      setSortOrder(field === 'number' || field === 'loadingDate' || field === 'deliveryDate' ? 'desc' : 'asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // ===== Modal Nova Entrega =====

  const handleOpenModal = () => {
    setModalOrderId('')
    setModalVehicleId('')
    setModalDriverId('')
    setModalLoadingDate(todayStr())
    setModalAddress('')
    setModalNotes('')
    setModalItems([])
    setModalQtyEdits({})
    setModalError(null)
    setShowModal(true)
  }

  const handleSelectOrder = async (orderId: string) => {
    setModalOrderId(orderId)
    if (!orderId) {
      setModalItems([])
      setModalQtyEdits({})
      setModalAddress('')
      return
    }

    setModalLoading(true)
    setModalError(null)
    try {
      const [check, address] = await Promise.all([
        getDeliveryCheckForOrder(orderId),
        getDeliveryAddress(orderId),
      ])
      setModalItems(check)
      setModalAddress(address)

      // Pré-preencher quantidades = remaining (capped by availableStock)
      const edits: Record<string, number> = {}
      for (const item of check) {
        edits[item.orderItemId] = Math.min(item.remaining, Math.max(0, item.availableStock))
      }
      setModalQtyEdits(edits)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erro ao carregar itens')
    } finally {
      setModalLoading(false)
    }
  }

  const handleCreateDelivery = async () => {
    setModalSaving(true)
    setModalError(null)

    try {
      const items = modalItems
        .filter((item) => (modalQtyEdits[item.orderItemId] || 0) > 0)
        .map((item) => ({
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantityPieces: modalQtyEdits[item.orderItemId] || 0,
        }))

      if (items.length === 0) {
        throw new Error('Informe a quantidade de pelo menos um item')
      }

      await createDelivery({
        orderId: modalOrderId,
        vehicleId: modalVehicleId,
        driverId: modalDriverId,
        loadingDate: modalLoadingDate,
        deliveryAddress: modalAddress,
        notes: modalNotes,
        items,
      })

      setShowModal(false)
      await refreshAll()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erro ao criar entrega')
    } finally {
      setModalSaving(false)
    }
  }

  // ===== Ações =====

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDeliveryStatus(id, newStatus as DeliveryStatus)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  const handleDelete = async (d: DeliveryRow) => {
    if (!confirm(`Excluir entrega ${fmtDeliveryNumber(d.number)}?`)) return
    try {
      await deleteDelivery(d.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Entregas</h1>
        <button
          onClick={handleOpenModal}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Nova Entrega
        </button>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Carregando</div>
          <div className="text-3xl font-bold text-amber-600">{kpis.loading}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Em Trânsito</div>
          <div className="text-3xl font-bold text-blue-600">{kpis.inTransit}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Entregues</div>
          <div className="text-3xl font-bold text-green-600">{kpis.delivered}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-3xl font-bold text-gray-900">{kpis.total}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <option value="LOADING">Carregando</option>
              <option value="IN_TRANSIT">Em Trânsito</option>
              <option value="DELIVERED">Entregue</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="">Todos</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatPlate(v.plate)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
              <option value="">Todos</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
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
        {deliveries.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {kpis.total === 0
              ? 'Nenhuma entrega cadastrada'
              : 'Nenhuma entrega encontrada com os filtros aplicados'}
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
                      Pedido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Veículo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Motorista
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('loadingDate')}
                    >
                      Carregamento <SortIndicator field="loadingDate" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('deliveryDate')}
                    >
                      Entrega <SortIndicator field="deliveryDate" />
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
                  {deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {fmtDeliveryNumber(d.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#3bbfb5] font-medium">
                        {fmtOrderNumber(d.order.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {d.order.customer.tradeName || d.order.customer.companyName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {d.vehicle ? formatPlate(d.vehicle.plate) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {d.driver?.name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(d.loadingDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {d.deliveryDate ? formatDate(d.deliveryDate) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                          {STATUS_LABELS[d.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {d.status === 'LOADING' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(d.id, 'IN_TRANSIT')}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                              >
                                Despachar
                              </button>
                              <button
                                onClick={() => handleDelete(d)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                          {d.status === 'IN_TRANSIT' && (
                            <button
                              onClick={() => handleStatusChange(d.id, 'DELIVERED')}
                              className="text-green-600 hover:text-green-800 text-xs font-medium px-1"
                            >
                              Confirmar Entrega
                            </button>
                          )}
                          {(d.status === 'LOADING' || d.status === 'IN_TRANSIT') && (
                            <button
                              onClick={() => {
                                if (confirm(`Cancelar entrega ${fmtDeliveryNumber(d.number)}? O estoque será revertido.`)) {
                                  handleStatusChange(d.id, 'CANCELLED')
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
                  Mostrando {startItem} a {endItem} de {total} entregas
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

      {/* Modal Nova Entrega */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Nova Entrega</h2>

              {modalError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
                  {modalError}
                </div>
              )}

              {/* Pedido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pedido *</label>
                  <select
                    value={modalOrderId}
                    onChange={(e) => handleSelectOrder(e.target.value)}
                  >
                    <option value="">Selecione um pedido...</option>
                    {readyOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {fmtOrderNumber(o.number)} — {o.customer.tradeName || o.customer.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Carregamento *</label>
                  <input
                    type="date"
                    value={modalLoadingDate}
                    onChange={(e) => setModalLoadingDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
                  <select
                    value={modalVehicleId}
                    onChange={(e) => setModalVehicleId(e.target.value)}
                  >
                    <option value="">Nenhum</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatPlate(v.plate)} {v.description ? `— ${v.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
                  <select
                    value={modalDriverId}
                    onChange={(e) => setModalDriverId(e.target.value)}
                  >
                    <option value="">Nenhum</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Endereço */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de Entrega</label>
                <input
                  type="text"
                  value={modalAddress}
                  onChange={(e) => setModalAddress(e.target.value)}
                  placeholder="Endereço completo..."
                  className="w-full"
                />
              </div>

              {/* Tabela de itens */}
              {modalLoading ? (
                <div className="py-8 text-center text-gray-500">Verificando itens e estoque...</div>
              ) : modalItems.length > 0 ? (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pedido</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Já Entregue</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Restante</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty Entregar</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {modalItems.map((item) => {
                        const qty = modalQtyEdits[item.orderItemId] ?? 0
                        const exceedsRemaining = qty > item.remaining
                        const exceedsStock = qty > item.availableStock

                        return (
                          <tr key={item.orderItemId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {fmtInt(item.quantityPieces)} pç
                              {item.unit === 'M2' && (
                                <span className="text-xs text-gray-400 block">
                                  ({item.quantityOrdered.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={item.alreadyDelivered > 0 ? 'text-teal-600' : 'text-gray-400'}>
                                {fmtInt(item.alreadyDelivered)} pç
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              {item.remaining === 0 ? (
                                <span className="text-green-600">Completo</span>
                              ) : (
                                <span>{fmtInt(item.remaining)} pç</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.remaining === 0 ? (
                                <span className="text-green-600 text-sm">-</span>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.remaining}
                                    value={qty}
                                    onChange={(e) =>
                                      setModalQtyEdits({
                                        ...modalQtyEdits,
                                        [item.orderItemId]: Math.max(0, parseInt(e.target.value) || 0),
                                      })
                                    }
                                    className={`w-24 text-right text-sm border rounded px-2 py-1 ${
                                      exceedsRemaining || exceedsStock
                                        ? 'border-red-400 bg-red-50'
                                        : 'border-gray-300'
                                    }`}
                                  />
                                  <span className="text-xs text-gray-500">pç</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={item.availableStock > 0 ? 'text-green-600' : 'text-red-500'}>
                                {fmtInt(item.availableStock)} pç
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : modalOrderId ? (
                <div className="py-4 text-center text-gray-500 text-sm">Nenhum item encontrado</div>
              ) : null}

              {/* Observações */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações da entrega..."
                  className="w-full"
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateDelivery}
                  disabled={modalSaving || !modalOrderId}
                  className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
                >
                  {modalSaving ? 'Criando...' : 'Criar Entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
