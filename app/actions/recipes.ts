'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== INGREDIENTES ====================

export async function getIngredients() {
  return prisma.ingredient.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function createIngredient(data: { name: string; unit: string; unitPrice: number }) {
  const ingredient = await prisma.ingredient.create({
    data,
  })

  revalidatePath('/produtos')
  return ingredient
}

export async function updateIngredient(id: string, data: { name?: string; unit?: string; unitPrice?: number }) {
  const ingredient = await prisma.ingredient.update({
    where: { id },
    data,
  })

  revalidatePath('/produtos')
  return ingredient
}

export async function deleteIngredient(id: string) {
  await prisma.ingredient.delete({
    where: { id },
  })

  revalidatePath('/produtos')
}

// ==================== PRODUTOS ====================

export async function getProductsWithRecipes() {
  return prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      costRecipe: {
        include: {
          items: {
            include: { ingredient: true },
          },
        },
      },
    },
  })
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id },
  })

  revalidatePath('/produtos')
  revalidatePath('/dia')
}

// ==================== RECEITAS ====================

export async function getRecipeByProduct(productId: string) {
  return prisma.costRecipe.findUnique({
    where: { productId },
    include: {
      product: true,
      items: {
        include: { ingredient: true },
      },
    },
  })
}

interface RecipeItemInput {
  ingredientId: string
  quantity: number
}

interface RecipeInput {
  productId: string
  density?: number | null
  piecesPerCycle: number
  cyclesPerBatch: number
  piecesPerM2: number
  avgPieceWeightKg: number
  palletCost: number
  strappingCost: number
  plasticCost: number
  items: RecipeItemInput[]
}

export async function saveRecipe(input: RecipeInput) {
  // Verificar se já existe uma receita para este produto
  const existingRecipe = await prisma.costRecipe.findUnique({
    where: { productId: input.productId },
  })

  if (existingRecipe) {
    // Atualizar receita existente
    await prisma.recipeItem.deleteMany({
      where: { recipeId: existingRecipe.id },
    })

    const recipe = await prisma.costRecipe.update({
      where: { id: existingRecipe.id },
      data: {
        density: input.density,
        piecesPerCycle: input.piecesPerCycle,
        cyclesPerBatch: input.cyclesPerBatch,
        piecesPerM2: input.piecesPerM2,
        avgPieceWeightKg: input.avgPieceWeightKg,
        palletCost: input.palletCost,
        strappingCost: input.strappingCost,
        plasticCost: input.plasticCost,
        items: {
          create: input.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    revalidatePath('/produtos')
    return recipe
  } else {
    // Criar nova receita
    const recipe = await prisma.costRecipe.create({
      data: {
        productId: input.productId,
        density: input.density,
        piecesPerCycle: input.piecesPerCycle,
        cyclesPerBatch: input.cyclesPerBatch,
        piecesPerM2: input.piecesPerM2,
        avgPieceWeightKg: input.avgPieceWeightKg,
        palletCost: input.palletCost,
        strappingCost: input.strappingCost,
        plasticCost: input.plasticCost,
        items: {
          create: input.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    revalidatePath('/produtos')
    return recipe
  }
}

export async function deleteRecipe(id: string) {
  await prisma.costRecipe.delete({
    where: { id },
  })

  revalidatePath('/produtos')
}
