import { getProductsWithRecipes, getIngredients } from '@/app/actions/recipes'
import { ProdutosClient } from './ProdutosClient'

export default async function ProdutosPage() {
  const [products, ingredients] = await Promise.all([
    getProductsWithRecipes(),
    getIngredients(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Produtos e Receitas de Custo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie produtos e suas receitas de custo de produção
        </p>
      </div>

      <ProdutosClient products={products} ingredients={ingredients} />
    </div>
  )
}
