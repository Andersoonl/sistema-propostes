import { getDriversPaginated } from '@/app/actions/drivers'
import { MotoristasClient } from './MotoristasClient'

export default async function MotoristasPage() {
  const initialData = await getDriversPaginated({ page: 1, pageSize: 20 })

  return <MotoristasClient initialData={initialData} />
}
