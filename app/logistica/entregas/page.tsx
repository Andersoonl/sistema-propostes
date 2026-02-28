import { getDeliveriesPaginated, getDeliveryKPIs, getReadyOrders } from '@/app/actions/deliveries'
import { getAllActiveVehicles } from '@/app/actions/vehicles'
import { getAllActiveDrivers } from '@/app/actions/drivers'
import { EntregasClient } from './EntregasClient'

export default async function EntregasPage() {
  const [initialData, kpis, readyOrders, vehicles, drivers] = await Promise.all([
    getDeliveriesPaginated({ page: 1, pageSize: 20 }),
    getDeliveryKPIs(),
    getReadyOrders(),
    getAllActiveVehicles(),
    getAllActiveDrivers(),
  ])

  return (
    <EntregasClient
      initialData={initialData}
      initialKPIs={kpis}
      readyOrders={readyOrders}
      vehicles={vehicles}
      drivers={drivers}
    />
  )
}
