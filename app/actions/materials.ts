'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== ENTRADAS (COMPRAS) ====================

interface CreateMaterialEntryInput {
  ingredientId: string
  date: Date
  quantity: number
  unitPrice: number
  supplier?: string
  invoiceNumber?: string
  notes?: string
}

export async function createMaterialEntry(input: CreateMaterialEntryInput) {
  const entry = await prisma.materialEntry.create({
    data: {
      ingredientId: input.ingredientId,
      date: new Date(input.date),
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      supplier: input.supplier,
      invoiceNumber: input.invoiceNumber,
      notes: input.notes,
    },
  })

  revalidatePath('/materiais')
  return entry
}

export async function getMaterialEntries(filters?: {
  ingredientId?: string
  startDate?: Date
  endDate?: Date
}) {
  return prisma.materialEntry.findMany({
    where: {
      ...(filters?.ingredientId && { ingredientId: filters.ingredientId }),
      ...(filters?.startDate && filters?.endDate && {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      }),
    },
    include: {
      ingredient: true,
    },
    orderBy: { date: 'desc' },
  })
}

export async function deleteMaterialEntry(id: string) {
  await prisma.materialEntry.delete({
    where: { id },
  })

  revalidatePath('/materiais')
}

// ==================== CONSUMO (DERIVADO DA PRODUÇÃO) ====================

interface IngredientConsumption {
  ingredientId: string
  ingredientName: string
  unit: string
  totalConsumed: number
}

export async function getMonthlyConsumption(year: number, month: number): Promise<IngredientConsumption[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Buscar todos os ProductionItems do mês
  const productionItems = await prisma.productionItem.findMany({
    where: {
      productionDay: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      product: {
        include: {
          costRecipe: {
            include: {
              items: {
                include: { ingredient: true },
              },
            },
          },
        },
      },
    },
  })

  // Para cada item: traços = ciclos / cyclesPerBatch; consumo = traços * recipeItem.quantity
  const consumptionMap = new Map<string, IngredientConsumption>()

  for (const item of productionItems) {
    const recipe = item.product.costRecipe
    if (!recipe) continue

    const batches = item.cycles / recipe.cyclesPerBatch

    for (const recipeItem of recipe.items) {
      const consumed = batches * recipeItem.quantity
      const existing = consumptionMap.get(recipeItem.ingredientId)

      if (existing) {
        existing.totalConsumed += consumed
      } else {
        consumptionMap.set(recipeItem.ingredientId, {
          ingredientId: recipeItem.ingredientId,
          ingredientName: recipeItem.ingredient.name,
          unit: recipeItem.ingredient.unit,
          totalConsumed: consumed,
        })
      }
    }
  }

  return Array.from(consumptionMap.values())
    .map((c) => ({
      ...c,
      totalConsumed: Math.round(c.totalConsumed * 100) / 100,
    }))
    .sort((a, b) => b.totalConsumed - a.totalConsumed)
}

// ==================== ESTOQUE ====================

interface MaterialStockItem {
  ingredientId: string
  ingredientName: string
  unit: string
  unitPrice: number
  totalPurchased: number
  totalConsumed: number
  balance: number
  estimatedValue: number
}

export async function getMaterialStock(): Promise<MaterialStockItem[]> {
  // Buscar todos os ingredientes
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: 'asc' },
  })

  // Buscar todas as entradas (compras)
  const entries = await prisma.materialEntry.findMany()

  // Calcular total comprado por ingrediente
  const purchaseMap = new Map<string, number>()
  for (const entry of entries) {
    purchaseMap.set(entry.ingredientId, (purchaseMap.get(entry.ingredientId) || 0) + entry.quantity)
  }

  // Calcular consumo total (de todas as produções)
  const allProductionItems = await prisma.productionItem.findMany({
    include: {
      product: {
        include: {
          costRecipe: {
            include: {
              items: true,
            },
          },
        },
      },
    },
  })

  const consumptionMap = new Map<string, number>()
  for (const item of allProductionItems) {
    const recipe = item.product.costRecipe
    if (!recipe) continue

    const batches = item.cycles / recipe.cyclesPerBatch

    for (const recipeItem of recipe.items) {
      const consumed = batches * recipeItem.quantity
      consumptionMap.set(recipeItem.ingredientId, (consumptionMap.get(recipeItem.ingredientId) || 0) + consumed)
    }
  }

  return ingredients.map((ing) => {
    const totalPurchased = purchaseMap.get(ing.id) || 0
    const totalConsumed = consumptionMap.get(ing.id) || 0
    const balance = totalPurchased - totalConsumed

    return {
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
      unitPrice: ing.unitPrice,
      totalPurchased: Math.round(totalPurchased * 100) / 100,
      totalConsumed: Math.round(totalConsumed * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      estimatedValue: Math.round(balance * ing.unitPrice * 100) / 100,
    }
  })
}
