import { getMachines, getProducts } from '@/app/actions/production'
import { DiaClient } from './DiaClient'

export default async function DiaPage() {
  const [machines, products] = await Promise.all([
    getMachines(),
    getProducts(),
  ])

  return (
    <DiaClient
      machines={machines}
      products={products}
    />
  )
}
