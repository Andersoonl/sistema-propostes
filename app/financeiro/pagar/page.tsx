import {
  getPayablesPaginated,
  getPayableKPIs,
  getActiveSuppliers,
} from '@/app/actions/payables'
import { PagarClient } from './PagarClient'

export default async function PagarPage() {
  const [initialData, kpis, suppliers] = await Promise.all([
    getPayablesPaginated({ page: 1, pageSize: 20 }),
    getPayableKPIs(),
    getActiveSuppliers(),
  ])

  return (
    <PagarClient
      initialData={initialData}
      initialKPIs={kpis}
      suppliers={suppliers}
    />
  )
}
