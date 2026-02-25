import {
  getCustomersPaginated,
  getCustomerCities,
  getCustomerCounts,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
} from '@/app/actions/customers'
import { CadastroCRUD } from '../CadastroCRUD'
import type { CadastroConfig } from '../types'

const config: CadastroConfig = {
  entityName: 'cliente',
  entityLabel: 'Cliente',
  pluralLabel: 'Clientes',
  actions: {
    getPaginated: getCustomersPaginated,
    getCities: getCustomerCities,
    getCounts: getCustomerCounts,
    create: createCustomer,
    update: updateCustomer,
    delete: deleteCustomer,
    toggleStatus: toggleCustomerStatus,
  },
}

export default async function ClientesPage() {
  const [initialResult, cities, counts] = await Promise.all([
    getCustomersPaginated({ page: 1, pageSize: 20 }),
    getCustomerCities(),
    getCustomerCounts(),
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
