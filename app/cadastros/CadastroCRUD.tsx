'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDocument, formatPhone, formatCEP, onlyDigits, maskDocument, maskPhone, maskCEP } from '@/lib/document'
import { fetchCEP } from '@/lib/viacep'
import { checkDocumentExists } from '@/app/actions/entities'
import type { Entity, EntityFormData, CadastroConfig, PaginatedResult, EntityCounts, SortField } from './types'

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const emptyForm: EntityFormData = {
  companyName: '',
  tradeName: '',
  document: '',
  stateRegistration: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  contactName: '',
  notes: '',
}

const PAGE_SIZE = 20

interface CadastroCRUDProps {
  config: CadastroConfig
  initialResult: PaginatedResult<Entity>
  initialCities: string[]
  initialCounts: EntityCounts
}

export function CadastroCRUD({ config, initialResult, initialCities, initialCounts }: CadastroCRUDProps) {
  // Dados paginados
  const [entities, setEntities] = useState<Entity[]>(initialResult.data)
  const [total, setTotal] = useState(initialResult.total)
  const [page, setPage] = useState(initialResult.page)
  const [totalPages, setTotalPages] = useState(initialResult.totalPages)
  const [cities, setCities] = useState<string[]>(initialCities)
  const [counts, setCounts] = useState<EntityCounts>(initialCounts)

  // Formulário
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<EntityFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [docWarning, setDocWarning] = useState<string | null>(null)
  const [checkingDoc, setCheckingDoc] = useState(false)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [cityFilter, setCityFilter] = useState('')

  // Ordenação
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Loading
  const [loading, setLoading] = useState(false)
  const isFirstRender = useRef(true)

  // Debounce da busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch quando filtros/ordenação/página mudam
  const fetchData = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const result = await config.actions.getPaginated({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter,
        city: cityFilter || undefined,
        sortBy: sortField || undefined,
        sortOrder: sortField ? sortOrder : undefined,
      })
      setEntities(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [config.actions, debouncedSearch, statusFilter, cityFilter, sortField, sortOrder])

  // Reagir a mudanças de filtro/sort (reseta para página 1)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, cityFilter, sortField, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    const [, newCities, newCounts] = await Promise.all([
      fetchData(page),
      config.actions.getCities(),
      config.actions.getCounts(),
    ])
    setCities(newCities)
    setCounts(newCounts)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    fetchData(newPage)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortField(null)
        setSortOrder('asc')
      }
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    }
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  const handleNew = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setError(null)
    setDocWarning(null)
    setShowForm(true)
  }

  const handleEdit = (entity: Entity) => {
    setEditingId(entity.id)
    setFormData({
      companyName: entity.companyName,
      tradeName: entity.tradeName || '',
      document: formatDocument(entity.document),
      stateRegistration: entity.stateRegistration || '',
      zipCode: entity.zipCode ? formatCEP(entity.zipCode) : '',
      street: entity.street || '',
      number: entity.number || '',
      complement: entity.complement || '',
      neighborhood: entity.neighborhood || '',
      city: entity.city || '',
      state: entity.state || '',
      phone: entity.phone ? formatPhone(entity.phone) : '',
      email: entity.email || '',
      contactName: entity.contactName || '',
      notes: entity.notes || '',
    })
    setError(null)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
    setError(null)
    setDocWarning(null)
  }

  const handleDocumentBlur = async () => {
    const digits = onlyDigits(formData.document)
    if (digits.length !== 11 && digits.length !== 14) {
      setDocWarning(null)
      return
    }
    setCheckingDoc(true)
    const result = await checkDocumentExists(formData.document, editingId || undefined)
    if (result) {
      setDocWarning(`Já existe um ${result.type} com este documento: ${result.name}`)
    } else {
      setDocWarning(null)
    }
    setCheckingDoc(false)
  }

  const handleCEPChange = async (value: string) => {
    const masked = maskCEP(value)
    setFormData((prev) => ({ ...prev, zipCode: masked }))

    const digits = onlyDigits(masked)
    if (digits.length === 8) {
      setLoadingCEP(true)
      const data = await fetchCEP(digits)
      if (data) {
        setFormData((prev) => ({
          ...prev,
          street: data.street || prev.street,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }))
      }
      setLoadingCEP(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingId) {
        await config.actions.update(editingId, formData)
      } else {
        await config.actions.create(formData)
      }
      setShowForm(false)
      setEditingId(null)
      setFormData(emptyForm)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o ${config.entityName} "${name}"?`)) return
    try {
      await config.actions.delete(id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleToggleStatus = async (id: string) => {
    try {
      await config.actions.toggleStatus(id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  // Cálculo do range exibido
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Cadastro de {config.pluralLabel}</h1>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Novo {config.entityLabel}
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total de {config.pluralLabel}</div>
          <div className="text-3xl font-bold text-gray-900">{counts.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Ativos</div>
          <div className="text-3xl font-bold text-green-600">{counts.active}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Inativos</div>
          <div className="text-3xl font-bold text-gray-400">{counts.inactive}</div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? `Editar ${config.entityLabel}` : `Novo ${config.entityLabel}`}
          </h2>
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identificação */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={formData.tradeName}
                    onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNPJ / CPF *
                  </label>
                  <input
                    type="text"
                    value={formData.document}
                    onChange={(e) => {
                      setFormData({ ...formData, document: maskDocument(e.target.value) })
                      setDocWarning(null)
                    }}
                    onBlur={handleDocumentBlur}
                    required
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                  {checkingDoc && (
                    <p className="text-xs text-gray-400 mt-1">Verificando...</p>
                  )}
                  {docWarning && (
                    <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      {docWarning}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inscrição Estadual
                  </label>
                  <input
                    type="text"
                    value={formData.stateRegistration}
                    onChange={(e) =>
                      setFormData({ ...formData, stateRegistration: e.target.value })
                    }
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">
                Endereço
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleCEPChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {loadingCEP && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        Buscando...
                      </span>
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Rua, Av, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="Nº"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={formData.complement}
                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                    placeholder="Sala, Bloco, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    placeholder="Bairro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {UF_LIST.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">
                Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="text"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contato Principal
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Nome do contato"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <h3 className="text-sm font-medium text-[#2d3e7e] uppercase tracking-wider mb-3">
                Observações
              </h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder={`Observações gerais sobre o ${config.entityName}...`}
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
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : `Cadastrar ${config.entityLabel}`}
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
              placeholder="Nome, fantasia ou CNPJ/CPF..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">Todas</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="px-6 py-2 bg-blue-50 text-blue-600 text-sm">Carregando...</div>
        )}
        {entities.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {counts.total === 0
              ? `Nenhum ${config.entityName} cadastrado`
              : `Nenhum ${config.entityName} encontrado com os filtros aplicados`}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('companyName')}
                    >
                      Razão Social <SortIndicator field="companyName" />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('tradeName')}
                    >
                      Fantasia <SortIndicator field="tradeName" />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('document')}
                    >
                      CNPJ/CPF <SortIndicator field="document" />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('cityState')}
                    >
                      Cidade/UF <SortIndicator field="cityState" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Telefone
                    </th>
                    <th
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIndicator field="status" />
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entities.map((entity) => (
                    <tr key={entity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {entity.companyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {entity.tradeName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {formatDocument(entity.document)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {entity.city && entity.state
                          ? `${entity.city}/${entity.state}`
                          : entity.city || entity.state || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {entity.phone ? formatPhone(entity.phone) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entity.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {entity.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(entity)}
                            className="text-[#2d3e7e] hover:text-[#1e2d5e] text-sm font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleStatus(entity.id)}
                            className={`text-sm font-medium ${
                              entity.status === 'ACTIVE'
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {entity.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleDelete(entity.id, entity.companyName)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Excluir
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
                  Mostrando {startItem} a {endItem} de {total} {config.pluralLabel.toLowerCase()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
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
