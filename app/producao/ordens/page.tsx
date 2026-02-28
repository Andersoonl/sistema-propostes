import { getProductionOrdersPaginated, getProductionOrderKPIs } from '@/app/actions/production-orders'
import { OrdensProducaoClient } from './OrdensProducaoClient'

export default async function OrdensProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>
}) {
  const params = await searchParams
  const orderId = params.orderId || undefined

  const [initialData, kpis] = await Promise.all([
    getProductionOrdersPaginated({ page: 1, pageSize: 20, orderId }),
    getProductionOrderKPIs(),
  ])

  return (
    <OrdensProducaoClient
      initialData={initialData}
      initialKPIs={kpis}
      initialOrderId={orderId || ''}
    />
  )
}
