import { getProductStock, getMovements } from '@/app/actions/inventory'
import { getProducts } from '@/app/actions/production'
import { EstoqueClient } from './EstoqueClient'

export default async function EstoquePage() {
  const [stock, movements, products] = await Promise.all([
    getProductStock(),
    getMovements(),
    getProducts(),
  ])

  return (
    <EstoqueClient
      initialStock={stock}
      initialMovements={movements}
      products={products}
    />
  )
}
