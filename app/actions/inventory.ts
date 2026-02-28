'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== MOVIMENTAÇÕES ====================

interface CreateMovementInput {
  productId: string
  date: Date
  type: 'OUT'  // IN é criado automaticamente via paletização
  quantityPieces: number
  notes?: string
}

export async function createMovement(input: CreateMovementInput) {
  // Buscar receita do produto para calcular pallets e m²
  const recipe = await prisma.costRecipe.findUnique({
    where: { productId: input.productId },
    select: { piecesPerPallet: true, piecesPerM2: true },
  })

  const quantityPallets = recipe?.piecesPerPallet
    ? input.quantityPieces / recipe.piecesPerPallet
    : null
  const areaM2 = recipe?.piecesPerM2
    ? input.quantityPieces / recipe.piecesPerM2
    : null

  const movement = await prisma.inventoryMovement.create({
    data: {
      productId: input.productId,
      date: new Date(input.date),
      type: input.type,
      quantityPieces: input.quantityPieces,
      quantityPallets,
      areaM2,
      notes: input.notes,
    },
  })

  revalidatePath('/estoque')
  return movement
}

export async function getMovements(filters?: {
  productId?: string
  type?: string
  startDate?: Date
  endDate?: Date
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.startDate && filters?.endDate && {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      }),
    },
    include: {
      product: true,
    },
    orderBy: { date: 'desc' },
  })
}

export async function deleteMovement(id: string) {
  // Não permitir excluir movimentações automáticas
  const movement = await prisma.inventoryMovement.findUnique({
    where: { id },
  })

  if (!movement) {
    throw new Error('Movimentação não encontrada')
  }

  if (movement.type === 'IN' && (movement.productionDayId || movement.palletizationId)) {
    throw new Error('Movimentações automáticas não podem ser excluídas. Use o módulo correspondente.')
  }

  await prisma.inventoryMovement.delete({
    where: { id },
  })

  revalidatePath('/estoque')
}

// ==================== CONSULTA DE ESTOQUE ====================

export interface ProductStockItem {
  productId: string
  productName: string
  // Disponível (palletizado, no estoque)
  availablePieces: number
  availablePallets: number | null
  availableM2: number | null
  // Em cura (produzido, não paletizado ainda)
  curingPieces: number
  // Peças soltas
  loosePieces: number
  // Totais de movimentação
  totalIn: number
  totalOut: number
  // Última movimentação
  lastMovementDate: string | null
}

export async function getProductStock(): Promise<ProductStockItem[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      costRecipe: {
        select: { piecesPerPallet: true, piecesPerM2: true },
      },
    },
  })

  // 1. Buscar movimentações de estoque → availablePieces
  const movements = await prisma.inventoryMovement.findMany({
    orderBy: { date: 'desc' },
  })

  const movementMap = new Map<string, {
    totalIn: number
    totalOut: number
    lastDate: Date | null
  }>()

  for (const mov of movements) {
    const existing = movementMap.get(mov.productId) || { totalIn: 0, totalOut: 0, lastDate: null }
    if (mov.type === 'IN') {
      existing.totalIn += mov.quantityPieces
    } else {
      existing.totalOut += mov.quantityPieces
    }
    if (!existing.lastDate || mov.date > existing.lastDate) {
      existing.lastDate = mov.date
    }
    movementMap.set(mov.productId, existing)
  }

  // 2. Buscar produção sem paletização e sem legado → curingPieces
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Buscar paletizações existentes
  const existingPalletizations = await prisma.palletization.findMany({
    select: { productId: true, productionDate: true },
  })
  const palletizedSet = new Set(
    existingPalletizations.map(
      (p) => `${p.productId}|${p.productionDate.toISOString().split('T')[0]}`
    )
  )

  // Buscar movimentações legadas
  const legacyMovements = await prisma.inventoryMovement.findMany({
    where: {
      type: 'IN',
      productionDayId: { not: null },
    },
    select: { productionDayId: true },
  })
  const legacyDayIds = new Set(legacyMovements.map((m) => m.productionDayId!))

  // Buscar todas as ProductionItems com cycles > 0 (pieces pode ser NULL se não há receita)
  const allProductionItems = await prisma.productionItem.findMany({
    where: {
      cycles: { gt: 0 },
      productionDay: {
        date: { lt: today },
      },
    },
    include: {
      productionDay: true,
    },
  })

  // Buscar receitas para recalcular peças quando pieces é NULL
  const curingProductIds = [...new Set(allProductionItems.map((i) => i.productId))]
  const curingRecipes = await prisma.costRecipe.findMany({
    where: { productId: { in: curingProductIds } },
    select: { productId: true, piecesPerCycle: true },
  })
  const curingRecipeMap = new Map(curingRecipes.map((r) => [r.productId, r]))

  // Agrupar curingPieces por produto
  const curingMap = new Map<string, number>()
  for (const item of allProductionItems) {
    const dateStr = item.productionDay.date.toISOString().split('T')[0]
    const key = `${item.productId}|${dateStr}`
    const isLegacy = legacyDayIds.has(item.productionDayId)
    if (!palletizedSet.has(key) && !isLegacy) {
      const recipe = curingRecipeMap.get(item.productId)
      const pieces = item.pieces ?? (recipe ? item.cycles * recipe.piecesPerCycle : item.cycles)
      curingMap.set(item.productId, (curingMap.get(item.productId) || 0) + pieces)
    }
  }

  // 3. Buscar peças soltas
  const looseBalances = await prisma.loosePiecesBalance.findMany()
  const looseMap = new Map(looseBalances.map((b) => [b.productId, b.pieces]))

  return products.map((product) => {
    const data = movementMap.get(product.id) || { totalIn: 0, totalOut: 0, lastDate: null }
    const availablePieces = data.totalIn - data.totalOut
    const curingPieces = curingMap.get(product.id) || 0
    const loosePieces = looseMap.get(product.id) || 0

    const availablePallets = product.costRecipe?.piecesPerPallet
      ? Math.round((availablePieces / product.costRecipe.piecesPerPallet) * 10) / 10
      : null
    const availableM2 = product.costRecipe?.piecesPerM2
      ? Math.round((availablePieces / product.costRecipe.piecesPerM2) * 10) / 10
      : null

    return {
      productId: product.id,
      productName: product.name,
      availablePieces,
      availablePallets,
      availableM2,
      curingPieces,
      loosePieces,
      totalIn: data.totalIn,
      totalOut: data.totalOut,
      lastMovementDate: data.lastDate?.toISOString().split('T')[0] || null,
    }
  }).filter((p) => p.totalIn > 0 || p.totalOut > 0 || p.curingPieces > 0 || p.loosePieces > 0)
}
