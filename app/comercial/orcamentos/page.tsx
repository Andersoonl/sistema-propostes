import { getQuotesPaginated, getQuoteKPIs, getActiveCustomers, getProductsWithRecipe } from '@/app/actions/quotes'
import { OrcamentosClient } from './OrcamentosClient'

export default async function OrcamentosPage() {
  const [initialData, kpis, customers, products] = await Promise.all([
    getQuotesPaginated({ page: 1, pageSize: 20 }),
    getQuoteKPIs(),
    getActiveCustomers(),
    getProductsWithRecipe(),
  ])

  return (
    <OrcamentosClient
      initialData={initialData}
      initialKPIs={kpis}
      customers={customers}
      products={products}
    />
  )
}
