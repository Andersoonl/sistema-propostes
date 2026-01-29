'use client'

import { useState, useEffect } from 'react'

interface Ingredient {
  id: string
  name: string
  unit: string
  unitPrice: number
}

interface RecipeItem {
  id: string
  ingredientId: string
  quantity: number
  ingredient: Ingredient
}

interface CostRecipe {
  id: string
  productId: string
  density: number | null
  piecesPerCycle: number
  cyclesPerBatch: number
  piecesPerM2: number
  avgPieceWeightKg: number
  palletCost: number
  strappingCost: number
  plasticCost: number
  items: RecipeItem[]
}

interface Product {
  id: string
  name: string
}

interface RecipeItemInput {
  ingredientId: string
  quantity: number
}

interface RecipeInput {
  productId: string
  density: number | null
  piecesPerCycle: number
  cyclesPerBatch: number
  piecesPerM2: number
  avgPieceWeightKg: number
  palletCost: number
  strappingCost: number
  plasticCost: number
  items: RecipeItemInput[]
}

interface Props {
  product: Product
  recipe: CostRecipe | null
  ingredients: Ingredient[]
  onClose: () => void
  onSave: (data: RecipeInput) => Promise<void>
  onDelete: (recipeId: string) => Promise<void>
}

export function RecipeForm({ product, recipe, ingredients, onClose, onSave, onDelete }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parâmetros de produção
  const [density, setDensity] = useState(recipe?.density ?? 0)
  const [piecesPerCycle, setPiecesPerCycle] = useState(recipe?.piecesPerCycle ?? 1)
  const [cyclesPerBatch, setCyclesPerBatch] = useState(recipe?.cyclesPerBatch ?? 1)
  const [piecesPerM2, setPiecesPerM2] = useState(recipe?.piecesPerM2 ?? 1)
  const [avgPieceWeightKg, setAvgPieceWeightKg] = useState(recipe?.avgPieceWeightKg ?? 0)

  // Custos extras
  const [palletCost, setPalletCost] = useState(recipe?.palletCost ?? 0)
  const [strappingCost, setStrappingCost] = useState(recipe?.strappingCost ?? 0)
  const [plasticCost, setPlasticCost] = useState(recipe?.plasticCost ?? 0)

  // Itens da receita
  const [recipeItems, setRecipeItems] = useState<{ ingredientId: string; quantity: number }[]>(
    recipe?.items.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
    })) ?? ingredients.map((ing) => ({ ingredientId: ing.id, quantity: 0 }))
  )

  // Inicializar itens com todos os ingredientes se não houver receita
  useEffect(() => {
    if (!recipe && ingredients.length > 0) {
      setRecipeItems(ingredients.map((ing) => ({ ingredientId: ing.id, quantity: 0 })))
    }
  }, [recipe, ingredients])

  // Cálculos
  const batchCost = recipeItems.reduce((sum, item) => {
    const ingredient = ingredients.find((i) => i.id === item.ingredientId)
    return sum + (ingredient ? item.quantity * ingredient.unitPrice : 0)
  }, 0)

  const piecesPerBatch = piecesPerCycle * cyclesPerBatch
  const extrasCost = palletCost + strappingCost + plasticCost
  const costPerPiece = piecesPerBatch > 0 ? (batchCost + extrasCost) / piecesPerBatch : 0
  const costPerM2 = costPerPiece * piecesPerM2

  const handleItemChange = (ingredientId: string, quantity: number) => {
    setRecipeItems((prev) =>
      prev.map((item) =>
        item.ingredientId === ingredientId ? { ...item, quantity } : item
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave({
        productId: product.id,
        density: density || null,
        piecesPerCycle,
        cyclesPerBatch,
        piecesPerM2,
        avgPieceWeightKg,
        palletCost,
        strappingCost,
        plasticCost,
        items: recipeItems.filter((item) => item.quantity > 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar receita')
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!recipe) return
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return

    setLoading(true)
    try {
      await onDelete(recipe.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir receita')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            Receita: {product.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Parâmetros de Produção */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Parâmetros de Produção</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Densidade
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={density}
                  onChange={(e) => setDensity(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peças/Ciclo
                </label>
                <input
                  type="number"
                  value={piecesPerCycle}
                  onChange={(e) => setPiecesPerCycle(parseInt(e.target.value) || 1)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  required
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciclos/Traço
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cyclesPerBatch}
                  onChange={(e) => setCyclesPerBatch(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  required
                  min={0.1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peças/m²
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={piecesPerM2}
                  onChange={(e) => setPiecesPerM2(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  required
                  min={0.01}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso Médio (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={avgPieceWeightKg}
                  onChange={(e) => setAvgPieceWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  required
                />
              </div>
            </div>
          </section>

          {/* Ingredientes */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Ingredientes (por Traço)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unidade
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Unit.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ingredients.map((ingredient) => {
                    const item = recipeItems.find((i) => i.ingredientId === ingredient.id)
                    const quantity = item?.quantity ?? 0
                    const cost = quantity * ingredient.unitPrice

                    return (
                      <tr key={ingredient.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ingredient.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {ingredient.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          R$ {ingredient.unitPrice.toFixed(4)}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={quantity}
                            onChange={(e) =>
                              handleItemChange(ingredient.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          R$ {cost.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      Custo do Traço:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      R$ {batchCost.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Custos Extras */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Custos Extras (por Traço)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pallet (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={palletCost}
                  onChange={(e) => setPalletCost(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fita de Arquear (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={strappingCost}
                  onChange={(e) => setStrappingCost(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plástico (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={plasticCost}
                  onChange={(e) => setPlasticCost(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                />
              </div>
            </div>
          </section>

          {/* Resumo de Custos */}
          <section className="bg-[#2d3e7e]/5 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo de Custos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Custo do Traço</p>
                <p className="text-xl font-bold text-gray-900">R$ {batchCost.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Peças por Traço</p>
                <p className="text-xl font-bold text-gray-900">{piecesPerBatch.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Custo por Peça</p>
                <p className="text-xl font-bold text-[#2d3e7e]">R$ {costPerPiece.toFixed(4)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Custo por m²</p>
                <p className="text-xl font-bold text-[#3bbfb5]">R$ {costPerM2.toFixed(2)}</p>
              </div>
            </div>
          </section>

          {/* Ações */}
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div>
              {recipe && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Excluir Receita
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#3bbfb5] text-white rounded-md hover:bg-[#2ea69d] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Salvar Receita'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
