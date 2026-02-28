'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getVehiclesPaginated,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  toggleVehicleStatus,
  type VehiclePaginationParams,
} from '@/app/actions/vehicles'

// ===== Tipos =====

interface VehicleRow {
  id: string
  plate: string
  description: string | null
  capacity: string | null
  status: string
  _count: { deliveries: number }
}

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
}

function formatPlate(plate: string) {
  if (plate.length === 7) {
    return `${plate.slice(0, 3)}-${plate.slice(3)}`
  }
  return plate
}

// ===== Componente =====

interface PaginatedData {
  data: VehicleRow[]
  total: number
  page: number
  totalPages: number
}

interface VeiculosClientProps {
  initialData: PaginatedData
}

export function VeiculosClient({ initialData }: VeiculosClientProps) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Ordenação
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Formulário
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formPlate, setFormPlate] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCapacity, setFormCapacity] = useState('')

  // UI
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
      const params: VehiclePaginationParams = {
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }
      const result = await getVehiclesPaginated(params)
      setVehicles(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, sortBy, sortOrder])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy(null)
        setSortOrder('asc')
      }
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // ===== Formulário =====

  const handleNew = () => {
    setEditingId(null)
    setFormPlate('')
    setFormDescription('')
    setFormCapacity('')
    setError(null)
    setShowForm(true)
  }

  const handleEdit = (v: VehicleRow) => {
    setEditingId(v.id)
    setFormPlate(formatPlate(v.plate))
    setFormDescription(v.description || '')
    setFormCapacity(v.capacity || '')
    setError(null)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const data = {
        plate: formPlate,
        description: formDescription,
        capacity: formCapacity,
      }

      if (editingId) {
        await updateVehicle(editingId, data)
      } else {
        await createVehicle(data)
      }

      setShowForm(false)
      setEditingId(null)
      await fetchData(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ===== Ações =====

  const handleDelete = async (v: VehicleRow) => {
    if (!confirm(`Excluir veículo ${formatPlate(v.plate)}?`)) return
    try {
      await deleteVehicle(v.id)
      await fetchData(page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleToggleStatus = async (v: VehicleRow) => {
    try {
      await toggleVehicleStatus(v.id)
      await fetchData(page)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Veículos</h1>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Novo Veículo
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Veículo' : 'Novo Veículo'}
          </h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
                <input
                  type="text"
                  value={formPlate}
                  onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  maxLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Caminhão Truck"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidade</label>
                <input
                  type="text"
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(e.target.value)}
                  placeholder="Ex: 12 toneladas"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Veículo'}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Placa, descrição..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="px-6 py-2 bg-blue-50 text-blue-600 text-sm">Carregando...</div>
        )}
        {vehicles.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {total === 0 && !search && statusFilter === 'ALL'
              ? 'Nenhum veículo cadastrado'
              : 'Nenhum veículo encontrado com os filtros aplicados'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('plate')}
                    >
                      Placa <SortIndicator field="plate" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('description')}
                    >
                      Descrição <SortIndicator field="description" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Capacidade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Entregas
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
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {formatPlate(v.plate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {v.description || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {v.capacity || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600">
                        {v._count.deliveries}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status]}`}>
                          {STATUS_LABELS[v.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(v)}
                            className="text-[#2d3e7e] hover:text-[#1e2d5e] text-xs font-medium px-1"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleStatus(v)}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium px-1"
                          >
                            {v.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                          </button>
                          {v._count.deliveries === 0 && (
                            <button
                              onClick={() => handleDelete(v)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium px-1"
                            >
                              Excluir
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
                  Mostrando {startItem} a {endItem} de {total} veículos
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
