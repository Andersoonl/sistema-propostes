import {
  getReceivablesPaginated,
  getReceivableKPIs,
  getActiveCustomers,
  getReadyOrdersForReceivable,
} from '@/app/actions/receivables'
import { ReceberClient } from './ReceberClient'

export default async function ReceberPage() {
  const [initialData, kpis, customers, readyOrders] = await Promise.all([
    getReceivablesPaginated({ page: 1, pageSize: 20 }),
    getReceivableKPIs(),
    getActiveCustomers(),
    getReadyOrdersForReceivable(),
  ])

  return (
    <ReceberClient
      initialData={initialData}
      initialKPIs={kpis}
      customers={customers}
      readyOrders={readyOrders}
    />
  )
}
