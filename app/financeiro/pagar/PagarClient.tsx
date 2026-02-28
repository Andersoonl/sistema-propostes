'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fmtPayableNumber, fmtMoney } from '@/lib/format'
import {
  getPayablesPaginated,
  getPayableKPIs,
  getActiveSuppliers,
  createPayable,
  updatePayable,
  deletePayable,
  cancelPayable,
  addPayablePayment,
  deletePayablePayment,
  getPayablePayments,
  type PayablePaginationParams,
  type PayableKPIs,
} from '@/app/actions/payables'

// ===== Tipos =====

interface SupplierOption {
  id: string
  companyName: string
  tradeName: string | null
}

interface PayableRow {
  id: string
  number: number
  supplierId: string | null
  description: string | null
  invoiceNumber: string | null
  issueDate: string
  dueDate: string
  totalAmount: number
  paidAmount: number
  category: string
  status: string
  notes: string | null
  supplier: { id: string; companyName: string; tradeName: string | null } | null
  _count: { payments: number }
}

interface PaymentRow {
  id: string
  paymentDate: string
  amount: number
  paymentMethod: string
  reference: string | null
  notes: string | null
}

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PARTIAL: 'Parcial',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIAL: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  RAW_MATERIAL: 'Matéria-Prima',
  ENERGY: 'Energia',
  MAINTENANCE: 'Manutenção',
  PAYROLL: 'Folha',
  TAXES: 'Impostos',
  OTHER: 'Outros',
}

const PAYMENT_METHODS = ['Boleto', 'PIX', 'Transferência', 'Cheque', 'Dinheiro']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ===== Componente =====

interface PaginatedData {
  data: PayableRow[]
  total: number
  page: number
  totalPages: number
}

interface PagarClientProps {
  initialData: PaginatedData
  initialKPIs: PayableKPIs
  suppliers: SupplierOption[]
}

export function PagarClient({ initialData, initialKPIs, suppliers: initialSuppliers }: PagarClientProps) {
  const [payables, setPayables] = useState<PayableRow[]>(initialData.data)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [kpis, setKpis] = useState<PayableKPIs>(initialKPIs)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>(initialSuppliers)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Ordenação
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modal Criar/Editar
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formSupplierId, setFormSupplierId] = useState('')
  const [formCategory, setFormCategory] = useState('OTHER')
  const [formDescription, setFormDescription] = useState('')
  const [formInvoice, setFormInvoice] = useState('')
  const [formIssueDate, setFormIssueDate] = useState(todayStr())
  const [formDueDate, setFormDueDate] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Modal Pagamento
  const [showPayModal, setShowPayModal] = useState(false)
  const [payPayable, setPayPayable] = useState<PayableRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayStr())
  const [payMethod, setPayMethod] = useState('PIX')
  const [payReference, setPayReference] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payPayments, setPayPayments] = useState<PaymentRow[]>([])
  const [payLoadingHistory, setPayLoadingHistory] = useState(false)

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
      const params: PayablePaginationParams = {
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        supplierId: supplierFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      }
      const result = await getPayablesPaginated(params)
      setPayables(result.data)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, categoryFilter, supplierFilter, dateFrom, dateTo, sortBy, sortOrder])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchData(1)
  }, [debouncedSearch, statusFilter, categoryFilter, supplierFilter, dateFrom, dateTo, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    const [, newKpis, newSuppliers] = await Promise.all([
      fetchData(page),
      getPayableKPIs(),
      getActiveSuppliers(),
    ])
    setKpis(newKpis)
    setSuppliers(newSuppliers)
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
      setSortOrder(field === 'number' || field === 'issueDate' || field === 'dueDate' || field === 'totalAmount' ? 'desc' : 'asc')
    }
  }

  const SortIndicator = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#9650;&#9660;</span>
    return <span className="ml-1">{sortOrder === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  // ===== Modal Criar/Editar =====

  const handleOpenCreate = () => {
    setEditId(null)
    setFormSupplierId('')
    setFormCategory('OTHER')
    setFormDescription('')
    setFormInvoice('')
    setFormIssueDate(todayStr())
    setFormDueDate('')
    setFormAmount('')
    setFormNotes('')
    setFormError(null)
    setShowModal(true)
  }

  const handleOpenEdit = (p: PayableRow) => {
    setEditId(p.id)
    setFormSupplierId(p.supplierId || '')
    setFormCategory(p.category)
    setFormDescription(p.description || '')
    setFormInvoice(p.invoiceNumber || '')
    setFormIssueDate(p.issueDate.split('T')[0])
    setFormDueDate(p.dueDate.split('T')[0])
    setFormAmount(String(p.totalAmount))
    setFormNotes(p.notes || '')
    setFormError(null)
    setShowModal(true)
  }

  const handleSavePayable = async () => {
    setFormSaving(true)
    setFormError(null)
    try {
      const data = {
        supplierId: formSupplierId,
        category: formCategory as 'RAW_MATERIAL' | 'ENERGY' | 'MAINTENANCE' | 'PAYROLL' | 'TAXES' | 'OTHER',
        description: formDescription,
        invoiceNumber: formInvoice,
        issueDate: formIssueDate,
        dueDate: formDueDate,
        totalAmount: parseFloat(formAmount) || 0,
        notes: formNotes,
      }

      if (editId) {
        await updatePayable(editId, data)
      } else {
        await createPayable(data)
      }

      setShowModal(false)
      await refreshAll()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setFormSaving(false)
    }
  }

  // ===== Modal Pagamento =====

  const handleOpenPayment = async (p: PayableRow) => {
    setPayPayable(p)
    setPayAmount(String(Math.round((p.totalAmount - p.paidAmount) * 100) / 100))
    setPayDate(todayStr())
    setPayMethod('PIX')
    setPayReference('')
    setPayNotes('')
    setPayError(null)
    setShowPayModal(true)

    setPayLoadingHistory(true)
    try {
      const payments = await getPayablePayments(p.id)
      setPayPayments(payments)
    } finally {
      setPayLoadingHistory(false)
    }
  }

  const handleSavePayment = async () => {
    if (!payPayable) return
    setPaySaving(true)
    setPayError(null)
    try {
      await addPayablePayment(payPayable.id, {
        amount: parseFloat(payAmount) || 0,
        paymentDate: payDate,
        paymentMethod: payMethod,
        reference: payReference,
        notes: payNotes,
      })
      setShowPayModal(false)
      await refreshAll()
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
    } finally {
      setPaySaving(false)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Excluir este pagamento? O valor será revertido.')) return
    try {
      await deletePayablePayment(paymentId)
      if (payPayable) {
        const payments = await getPayablePayments(payPayable.id)
        setPayPayments(payments)
      }
      await refreshAll()
      setShowPayModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir pagamento')
    }
  }

  // ===== Ações =====

  const handleDelete = async (p: PayableRow) => {
    if (!confirm(`Excluir conta ${fmtPayableNumber(p.number)}?`)) return
    try {
      await deletePayable(p.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleCancel = async (p: PayableRow) => {
    if (!confirm(`Cancelar conta ${fmtPayableNumber(p.number)}?`)) return
    try {
      await cancelPayable(p.id)
      await refreshAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar')
    }
  }

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] transition-colors font-medium"
        >
          + Nova Conta
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">A Pagar</div>
          <div className="text-2xl font-bold text-blue-600">{fmtMoney(kpis.totalPending)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Vencido</div>
          <div className="text-2xl font-bold text-red-600">{fmtMoney(kpis.totalOverdue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pago no Mês</div>
          <div className="text-2xl font-bold text-green-600">{fmtMoney(kpis.totalPaidMonth)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Geral</div>
          <div className="text-2xl font-bold text-gray-900">{fmtMoney(kpis.totalAmount)}</div>
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
              placeholder="Nº, fornecedor..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pago</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="ALL">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tradeName || s.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venc. De</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venc. Até</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && (
          <div className="px-6 py-2 bg-blue-50 text-blue-600 text-sm">Carregando...</div>
        )}
        {payables.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            {total === 0 && statusFilter === 'ALL' && categoryFilter === 'ALL' && !search
              ? 'Nenhuma conta a pagar cadastrada'
              : 'Nenhuma conta encontrada com os filtros aplicados'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('number')}>
                      Nº <SortIndicator field="number" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('supplier')}>
                      Fornecedor <SortIndicator field="supplier" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('category')}>
                      Categoria <SortIndicator field="category" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('issueDate')}>
                      Emissão <SortIndicator field="issueDate" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('dueDate')}>
                      Vencimento <SortIndicator field="dueDate" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('totalAmount')}>
                      Valor <SortIndicator field="totalAmount" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Pago
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('status')}>
                      Status <SortIndicator field="status" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payables.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-[#2d3e7e]">
                        {fmtPayableNumber(p.number)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {p.supplier ? (p.supplier.tradeName || p.supplier.companyName) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-sm">
                        {CATEGORY_LABELS[p.category] || p.category}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {p.description || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(p.issueDate)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${p.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-600'}`}>
                        {formatDate(p.dueDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                        {fmtMoney(p.totalAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className={p.paidAmount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {fmtMoney(p.paidAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {['PENDING', 'OVERDUE', 'PARTIAL'].includes(p.status) && (
                            <button
                              onClick={() => handleOpenPayment(p)}
                              className="text-green-600 hover:text-green-800 text-xs font-medium px-1"
                            >
                              Pagar
                            </button>
                          )}
                          {['PENDING', 'OVERDUE'].includes(p.status) && (
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                            >
                              Editar
                            </button>
                          )}
                          {['PENDING', 'OVERDUE', 'PARTIAL'].includes(p.status) && (
                            <button
                              onClick={() => handleCancel(p)}
                              className="text-red-500 hover:text-red-700 text-xs font-medium px-1"
                            >
                              Cancelar
                            </button>
                          )}
                          {p.status !== 'PAID' && p.status !== 'CANCELLED' && p._count.payments === 0 && (
                            <button
                              onClick={() => handleDelete(p)}
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
                  Mostrando {startItem} a {endItem} de {total} contas
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

      {/* Modal Criar/Editar Conta a Pagar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
              </h2>

              {formError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                  <select
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                  >
                    <option value="">Sem fornecedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tradeName || s.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ex: Conta de energia fev/2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Nota Fiscal</label>
                  <input
                    type="text"
                    value={formInvoice}
                    onChange={(e) => setFormInvoice(e.target.value)}
                    placeholder="Ex: NF 5678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emissão *</label>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento *</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações..."
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
                  onClick={handleSavePayable}
                  disabled={formSaving || !formDescription || !formDueDate || !formAmount}
                  className="px-4 py-2 bg-[#3bbfb5] text-white rounded-lg hover:bg-[#2ea69d] disabled:opacity-50 transition-colors font-medium"
                >
                  {formSaving ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pagamento */}
      {showPayModal && payPayable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Registrar Pagamento</h2>

              {payError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
                  {payError}
                </div>
              )}

              {/* Info da conta */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Conta</span>
                    <div className="font-medium text-[#2d3e7e]">{fmtPayableNumber(payPayable.number)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Fornecedor</span>
                    <div className="font-medium">{payPayable.supplier ? (payPayable.supplier.tradeName || payPayable.supplier.companyName) : '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor Total</span>
                    <div className="font-medium">{fmtMoney(payPayable.totalAmount)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Restante</span>
                    <div className="font-bold text-red-600">
                      {fmtMoney(payPayable.totalAmount - payPayable.paidAmount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Histórico de pagamentos */}
              {payLoadingHistory ? (
                <div className="text-sm text-gray-500 mb-4">Carregando histórico...</div>
              ) : payPayments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Pagamentos anteriores</h3>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Data</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">Valor</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Forma</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Ref.</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payPayments.map((p) => (
                          <tr key={p.id} className="border-b border-gray-100">
                            <td className="py-2 px-3 text-gray-700">{formatDate(p.paymentDate)}</td>
                            <td className="py-2 px-3 text-right text-green-600 font-medium">{fmtMoney(p.amount)}</td>
                            <td className="py-2 px-3 text-gray-600">{p.paymentMethod}</td>
                            <td className="py-2 px-3 text-gray-500">{p.reference || '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleDeletePayment(p.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Formulário de pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payPayable.totalAmount - payPayable.paidAmount}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pagamento *</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento *</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referência</label>
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="Nº boleto, comprovante..."
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  placeholder="Observações do pagamento..."
                  className="w-full"
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Fechar
                </button>
                <button
                  onClick={handleSavePayment}
                  disabled={paySaving || !payAmount || !payDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {paySaving ? 'Registrando...' : 'Registrar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
