'use client'

import { useState } from 'react'
import { fmtInt, fmtMoney } from '@/lib/format'
import { createProduct, deleteProduct } from '@/app/actions/production'
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
  saveRecipe,
  deleteRecipe,
} from '@/app/actions/recipes'
import { RecipeForm } from './RecipeForm'
import { IngredientManager } from './IngredientManager'

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
  piecesPerPallet: number | null
  m2PerPallet: number | null
  palletCost: number
  strappingCost: number
  plasticCost: number
  items: RecipeItem[]
}

interface Product {
  id: string
  name: string
  category: string | null
  subcategory: string | null
  costRecipe: CostRecipe | null
}

interface Props {
  products: Product[]
  ingredients: Ingredient[]
}

const CATEGORIES = ['PISO INTERTRAVADO', 'BLOCO DE CONCRETO'] as const
const SUBCATEGORIES: Record<string, string[]> = {
  'PISO INTERTRAVADO': ['PAVER', 'PISOGRAMA', 'UNISTEIN', 'CITYPLAC'],
  'BLOCO DE CONCRETO': ['FAMILIA 09', 'FAMILIA 14', 'FAMILIA 19', 'FAMILIA 29'],
}

export function ProdutosClient({ products, ingredients }: Props) {
  const [showNewProductForm, setShowNewProductForm] = useState(false)
  const [showIngredientManager, setShowIngredientManager] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [newProductName, setNewProductName] = useState('')
  const [newProductCategory, setNewProductCategory] = useState('')
  const [newProductSubcategory, setNewProductSubcategory] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSubcategory, setFilterSubcategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtrar produtos
  const filteredProducts = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false
    if (filterSubcategory && p.subcategory !== filterSubcategory) return false
    return true
  })

  // Subcategorias disponíveis para o filtro
  const availableSubcategories = filterCategory ? (SUBCATEGORIES[filterCategory] || []) : []
  // Subcategorias para o formulário de novo produto
  const newProductSubcategories = newProductCategory ? (SUBCATEGORIES[newProductCategory] || []) : []

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProductName.trim()) return

    setLoading(true)
    setError(null)
    try {
      await createProduct(
        newProductName.trim(),
        newProductCategory || undefined,
        newProductSubcategory || undefined
      )
      setNewProductName('')
      setNewProductCategory('')
      setNewProductSubcategory('')
      setShowNewProductForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar produto')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${name}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    setLoading(true)
    try {
      await deleteProduct(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto')
    } finally {
      setLoading(false)
    }
  }

  const calculateCosts = (recipe: CostRecipe) => {
    const batchCost = recipe.items.reduce((sum, item) => {
      return sum + item.quantity * item.ingredient.unitPrice
    }, 0)

    const piecesPerBatch = recipe.piecesPerCycle * recipe.cyclesPerBatch
    const extrasCost = recipe.palletCost + recipe.strappingCost + recipe.plasticCost
    const costPerPiece = piecesPerBatch > 0 ? (batchCost + extrasCost) / piecesPerBatch : 0
    const costPerM2 = costPerPiece * recipe.piecesPerM2

    return { batchCost, costPerPiece, costPerM2, piecesPerBatch }
  }

  return (
    <div className="space-y-6">
      {/* Ações principais */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowNewProductForm(true)}
          className="inline-flex items-center px-4 py-2 bg-[#2d3e7e] text-white rounded-md hover:bg-[#253269] transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Produto
        </button>
        <button
          onClick={() => setShowIngredientManager(true)}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Gerenciar Ingredientes
        </button>
      </div>

      {/* Filtros por Categoria / Subcategoria */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value)
              setFilterSubcategory('')
            }}
            className="rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5] text-sm"
          >
            <option value="">Todas</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoria</label>
          <select
            value={filterSubcategory}
            onChange={(e) => setFilterSubcategory(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5] text-sm"
            disabled={!filterCategory}
          >
            <option value="">Todas</option>
            {availableSubcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500">
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Formulário de novo produto */}
      {showNewProductForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Produto</h3>
          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={newProductCategory}
                  onChange={(e) => {
                    setNewProductCategory(e.target.value)
                    setNewProductSubcategory('')
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                >
                  <option value="">Selecione...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoria</label>
                <select
                  value={newProductSubcategory}
                  onChange={(e) => setNewProductSubcategory(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  disabled={!newProductCategory}
                >
                  <option value="">Selecione...</option>
                  {newProductSubcategories.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Nome do produto"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5]"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowNewProductForm(false)
                  setNewProductName('')
                  setNewProductCategory('')
                  setNewProductSubcategory('')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !newProductName.trim()}
                className="px-4 py-2 bg-[#3bbfb5] text-white rounded-md hover:bg-[#2ea69d] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => {
          const recipe = product.costRecipe
          const costs = recipe ? calculateCosts(recipe) : null

          return (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                    {product.subcategory && (
                      <span className="text-xs text-gray-500">{product.subcategory}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {recipe ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Receita OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Sem receita
                      </span>
                    )}
                  </div>
                </div>

                {recipe && costs && (
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Custo/peça:</span>{' '}
                      {fmtMoney(costs.costPerPiece, 4)}
                    </p>
                    <p>
                      <span className="font-medium">Custo/m²:</span>{' '}
                      {fmtMoney(costs.costPerM2)}
                    </p>
                    <p>
                      <span className="font-medium">Peças/traço:</span>{' '}
                      {fmtInt(costs.piecesPerBatch)}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="flex-1 px-3 py-2 text-sm bg-[#2d3e7e] text-white rounded-md hover:bg-[#253269] transition-colors"
                  >
                    {recipe ? 'Editar Receita' : 'Criar Receita'}
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    disabled={loading}
                    className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum produto cadastrado</h3>
          <p className="mt-1 text-sm text-gray-500">Comece criando um novo produto.</p>
        </div>
      )}

      {/* Modal de Receita */}
      {selectedProduct && (
        <RecipeForm
          product={selectedProduct}
          recipe={selectedProduct.costRecipe}
          ingredients={ingredients}
          onClose={() => setSelectedProduct(null)}
          onSave={async (data) => {
            await saveRecipe(data)
            setSelectedProduct(null)
          }}
          onDelete={async (recipeId) => {
            await deleteRecipe(recipeId)
            setSelectedProduct(null)
          }}
        />
      )}

      {/* Modal de Ingredientes */}
      {showIngredientManager && (
        <IngredientManager
          ingredients={ingredients}
          onClose={() => setShowIngredientManager(false)}
          onCreate={createIngredient}
          onUpdate={updateIngredient}
          onDelete={deleteIngredient}
        />
      )}
    </div>
  )
}
