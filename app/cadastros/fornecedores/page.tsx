import {
  getSuppliersPaginated,
  getSupplierCities,
  getSupplierCounts,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
} from '@/app/actions/suppliers'
import { CadastroCRUD } from '../CadastroCRUD'
import type { CadastroConfig } from '../types'

const config: CadastroConfig = {
  entityName: 'fornecedor',
  entityLabel: 'Fornecedor',
  pluralLabel: 'Fornecedores',
  actions: {
    getPaginated: getSuppliersPaginated,
    getCities: getSupplierCities,
    getCounts: getSupplierCounts,
    create: createSupplier,
    update: updateSupplier,
    delete: deleteSupplier,
    toggleStatus: toggleSupplierStatus,
  },
}

export default async function FornecedoresPage() {
  const [initialResult, cities, counts] = await Promise.all([
    getSuppliersPaginated({ page: 1, pageSize: 20 }),
    getSupplierCities(),
    getSupplierCounts(),
  ])

  return (
    <CadastroCRUD
      config={config}
      initialResult={initialResult}
      initialCities={cities}
      initialCounts={counts}
    />
  )
}
