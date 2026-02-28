import { getOrdersPaginated, getOrderKPIs } from '@/app/actions/orders'
import { getActiveCustomers, getProductsWithRecipe } from '@/app/actions/quotes'
import { PedidosClient } from './PedidosClient'

export default async function PedidosPage() {
  const [initialData, kpis, customers, products] = await Promise.all([
    getOrdersPaginated({ page: 1, pageSize: 20 }),
    getOrderKPIs(),
    getActiveCustomers(),
    getProductsWithRecipe(),
  ])

  return (
    <PedidosClient
      initialData={initialData}
      initialKPIs={kpis}
      customers={customers}
      products={products}
    />
  )
}
