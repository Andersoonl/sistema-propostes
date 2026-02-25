export interface Entity {
  id: string
  companyName: string
  tradeName: string | null
  document: string
  documentType: string
  stateRegistration: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  contactName: string | null
  notes: string | null
  status: string
  createdAt: Date | string
  updatedAt: Date | string
}

export type EntityFormData = {
  companyName: string
  tradeName: string
  document: string
  stateRegistration: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  phone: string
  email: string
  contactName: string
  notes: string
}

export type SortField = 'companyName' | 'tradeName' | 'document' | 'cityState' | 'status'

export interface PaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE'
  city?: string
  sortBy?: SortField
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EntityCounts {
  total: number
  active: number
  inactive: number
}

export interface CadastroConfig {
  entityName: 'cliente' | 'fornecedor'
  entityLabel: string
  pluralLabel: string
  actions: {
    getPaginated: (params: PaginationParams) => Promise<PaginatedResult<Entity>>
    getCities: () => Promise<string[]>
    getCounts: () => Promise<EntityCounts>
    create: (data: EntityFormData) => Promise<Entity>
    update: (id: string, data: EntityFormData) => Promise<Entity>
    delete: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<void>
  }
}
