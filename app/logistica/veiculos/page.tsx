import { getVehiclesPaginated } from '@/app/actions/vehicles'
import { VeiculosClient } from './VeiculosClient'

export default async function VeiculosPage() {
  const initialData = await getVehiclesPaginated({ page: 1, pageSize: 20 })

  return <VeiculosClient initialData={initialData} />
}
