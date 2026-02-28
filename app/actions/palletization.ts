'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== TIPOS ====================

export interface PendingPalletization {
  productId: string
  productName: string
  productionDate: string // ISO date string
  theoreticalPieces: number
  loosePiecesBefore: number
  piecesPerPallet: number
  piecesPerM2: number | null
}

export interface MissingRecipeItem {
  productId: string
  productName: string
  productionDate: string
  totalCycles: number
}

export interface PalletizationRecord {
  id: string
  productId: string
  productName: string
  productionDate: string
  palletizedDate: string
  theoreticalPieces: number
  completePallets: number
  loosePiecesAfter: number
  piecesPerPallet: number
  realPieces: number
  lossPieces: number
  loosePiecesBefore: number
  notes: string | null
}

export interface LoosePiecesItem {
  productId: string
  productName: string
  pieces: number
  piecesPerPallet: number
}

// ==================== CONSULTAS ====================

export async function getPendingPalletizations(): Promise<{
  items: PendingPalletization[]
  missingRecipe: MissingRecipeItem[]
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Buscar todos os ProductionItem com cycles > 0 cujo ProductionDay.date < hoje
  // Usa cycles (não pieces) porque pieces pode ser NULL quando não há CostRecipe
  const productionItems = await prisma.productionItem.findMany({
    where: {
      cycles: { gt: 0 },
      productionDay: {
        date: { lt: today },
      },
    },
    include: {
      product: true,
      productionDay: true,
    },
  })

  // Buscar paletizações existentes
  const existingPalletizations = await prisma.palletization.findMany({
    select: { productId: true, productionDate: true },
  })
  const palletizedSet = new Set(
    existingPalletizations.map(
      (p) => `${p.productId}|${p.productionDate.toISOString().split('T')[0]}`
    )
  )

  // Buscar InventoryMovements legados (IN com productionDayId) para excluir produção já no estoque
  const legacyMovements = await prisma.inventoryMovement.findMany({
    where: {
      type: 'IN',
      productionDayId: { not: null },
    },
    select: { productionDayId: true },
  })
  const legacyDayIds = new Set(legacyMovements.map((m) => m.productionDayId!))

  // Filtrar itens que não possuem paletização E não são legado
  const pendingItems = productionItems.filter((item) => {
    const dateStr = item.productionDay.date.toISOString().split('T')[0]
    const key = `${item.productId}|${dateStr}`
    const isLegacy = legacyDayIds.has(item.productionDayId)
    return !palletizedSet.has(key) && !isLegacy
  })

  // Buscar TODAS as receitas para calcular peças teóricas
  const allProductIds = [...new Set(pendingItems.map((item) => item.productId))]
  const recipes = await prisma.costRecipe.findMany({
    where: { productId: { in: allProductIds } },
    select: { productId: true, piecesPerCycle: true, piecesPerPallet: true, piecesPerM2: true },
  })
  const recipeMap = new Map(recipes.map((r) => [r.productId, r]))

  // Agrupar por (productId, productionDate)
  const grouped = new Map<string, {
    productId: string
    productName: string
    productionDate: string
    totalCycles: number
    totalPieces: number
  }>()

  for (const item of pendingItems) {
    const dateStr = item.productionDay.date.toISOString().split('T')[0]
    const key = `${item.productId}|${dateStr}`
    const recipe = recipeMap.get(item.productId)
    // Calcular peças: usar pieces salvo OU recalcular via receita OU usar ciclos como fallback
    const itemPieces = item.pieces ?? (recipe ? item.cycles * recipe.piecesPerCycle : item.cycles)

    const existing = grouped.get(key)
    if (existing) {
      existing.totalCycles += item.cycles
      existing.totalPieces += itemPieces
    } else {
      grouped.set(key, {
        productId: item.productId,
        productName: item.product.name,
        productionDate: dateStr,
        totalCycles: item.cycles,
        totalPieces: itemPieces,
      })
    }
  }

  // Buscar saldos de peças soltas
  const looseBalances = await prisma.loosePiecesBalance.findMany()
  const looseMap = new Map(looseBalances.map((b) => [b.productId, b.pieces]))

  const allGrouped = Array.from(grouped.values())

  const items: PendingPalletization[] = allGrouped
    .filter((g) => {
      const recipe = recipeMap.get(g.productId)
      return recipe?.piecesPerPallet
    })
    .map((g) => {
      const recipe = recipeMap.get(g.productId)!
      return {
        productId: g.productId,
        productName: g.productName,
        productionDate: g.productionDate,
        theoreticalPieces: g.totalPieces,
        loosePiecesBefore: looseMap.get(g.productId) || 0,
        piecesPerPallet: recipe.piecesPerPallet!,
        piecesPerM2: recipe.piecesPerM2 || null,
      }
    })
    .sort((a, b) => a.productionDate.localeCompare(b.productionDate))

  const missingRecipe: MissingRecipeItem[] = allGrouped
    .filter((g) => {
      const recipe = recipeMap.get(g.productId)
      return !recipe?.piecesPerPallet
    })
    .map((g) => ({
      productId: g.productId,
      productName: g.productName,
      productionDate: g.productionDate,
      totalCycles: g.totalCycles,
    }))
    .sort((a, b) => a.productionDate.localeCompare(b.productionDate))

  return { items, missingRecipe }
}

export async function getPalletizationHistory(filters?: {
  startDate?: string
  endDate?: string
  productId?: string
}): Promise<PalletizationRecord[]> {
  const palletizations = await prisma.palletization.findMany({
    where: {
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.startDate && filters?.endDate && {
        palletizedDate: {
          gte: new Date(filters.startDate + 'T00:00:00'),
          lte: new Date(filters.endDate + 'T23:59:59'),
        },
      }),
    },
    include: {
      product: true,
    },
    orderBy: { palletizedDate: 'desc' },
  })

  return palletizations.map((p) => ({
    id: p.id,
    productId: p.productId,
    productName: p.product.name,
    productionDate: p.productionDate.toISOString().split('T')[0],
    palletizedDate: p.palletizedDate.toISOString().split('T')[0],
    theoreticalPieces: p.theoreticalPieces,
    completePallets: p.completePallets,
    loosePiecesAfter: p.loosePiecesAfter,
    piecesPerPallet: p.piecesPerPallet,
    realPieces: p.realPieces,
    lossPieces: p.lossPieces,
    loosePiecesBefore: p.loosePiecesBefore,
    notes: p.notes,
  }))
}

export async function getLoosePiecesBalances(): Promise<LoosePiecesItem[]> {
  const balances = await prisma.loosePiecesBalance.findMany({
    where: { pieces: { gt: 0 } },
    include: { product: true },
  })

  const productIds = balances.map((b) => b.productId)
  const recipes = await prisma.costRecipe.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, piecesPerPallet: true },
  })
  const recipeMap = new Map(recipes.map((r) => [r.productId, r]))

  return balances
    .filter((b) => recipeMap.get(b.productId)?.piecesPerPallet)
    .map((b) => ({
      productId: b.productId,
      productName: b.product.name,
      pieces: b.pieces,
      piecesPerPallet: recipeMap.get(b.productId)!.piecesPerPallet!,
    }))
    .sort((a, b) => b.pieces - a.pieces)
}

// ==================== AÇÕES ====================

interface SavePalletizationInput {
  productId: string
  productionDate: string // ISO date string YYYY-MM-DD
  completePallets: number
  loosePiecesAfter: number
  notes?: string
}

export async function savePalletization(input: SavePalletizationInput) {
  // Buscar receita
  const recipe = await prisma.costRecipe.findUnique({
    where: { productId: input.productId },
    select: { piecesPerCycle: true, piecesPerPallet: true, piecesPerM2: true },
  })

  if (!recipe?.piecesPerPallet) {
    throw new Error('Produto não possui receita com peças por pallet definido')
  }

  const piecesPerPallet = recipe.piecesPerPallet

  // Buscar saldo de peças soltas
  const looseBalance = await prisma.loosePiecesBalance.findUnique({
    where: { productId: input.productId },
  })
  const loosePiecesBefore = looseBalance?.pieces || 0

  // Buscar produção teórica do dia
  const productionDate = new Date(input.productionDate + 'T00:00:00')
  const productionItems = await prisma.productionItem.findMany({
    where: {
      productId: input.productId,
      productionDay: {
        date: productionDate,
      },
    },
  })
  // Usar pieces salvo OU recalcular via receita (ciclos × piecesPerCycle)
  const theoreticalPieces = productionItems.reduce((sum, item) => {
    return sum + (item.pieces ?? item.cycles * recipe.piecesPerCycle)
  }, 0)

  if (theoreticalPieces === 0) {
    throw new Error('Nenhuma produção encontrada para este produto nesta data')
  }

  // Validações
  if (input.completePallets < 0) {
    throw new Error('Pallets completos não pode ser negativo')
  }
  if (input.loosePiecesAfter < 0) {
    throw new Error('Peças soltas restantes não pode ser negativo')
  }

  // Cálculos
  const realPieces = input.completePallets * piecesPerPallet
  const lossPieces = theoreticalPieces + loosePiecesBefore - realPieces - input.loosePiecesAfter

  if (lossPieces < 0) {
    throw new Error(
      `Conta não fecha: peças em pallets (${realPieces}) + soltas restantes (${input.loosePiecesAfter}) ` +
      `ultrapassa o disponível (${theoreticalPieces} teórico + ${loosePiecesBefore} soltas anteriores = ${theoreticalPieces + loosePiecesBefore})`
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calcular m² e pallets para o InventoryMovement
  const areaM2 = recipe.piecesPerM2 ? realPieces / recipe.piecesPerM2 : null

  // Transação
  const result = await prisma.$transaction(async (tx) => {
    // 1. Criar Palletization
    const palletization = await tx.palletization.create({
      data: {
        productId: input.productId,
        productionDate,
        palletizedDate: today,
        theoreticalPieces,
        completePallets: input.completePallets,
        loosePiecesAfter: input.loosePiecesAfter,
        piecesPerPallet,
        realPieces,
        lossPieces,
        loosePiecesBefore,
        notes: input.notes,
      },
    })

    // 2. Atualizar saldo de peças soltas
    await tx.loosePiecesBalance.upsert({
      where: { productId: input.productId },
      update: { pieces: input.loosePiecesAfter },
      create: { productId: input.productId, pieces: input.loosePiecesAfter },
    })

    // 3. Criar InventoryMovement (só se há pallets completos)
    if (input.completePallets > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          date: today,
          type: 'IN',
          quantityPieces: realPieces,
          quantityPallets: input.completePallets,
          areaM2,
          palletizationId: palletization.id,
          notes: `Paletização - ${input.completePallets} pallets`,
        },
      })
    }

    return palletization
  })

  revalidatePath('/paletizacao')
  revalidatePath('/estoque')
  revalidatePath('/dash/cadeia')

  return result
}

export async function deletePalletization(id: string) {
  const palletization = await prisma.palletization.findUnique({
    where: { id },
  })

  if (!palletization) {
    throw new Error('Paletização não encontrada')
  }

  await prisma.$transaction(async (tx) => {
    // 1. Reverter saldo de peças soltas
    const currentBalance = await tx.loosePiecesBalance.findUnique({
      where: { productId: palletization.productId },
    })

    if (currentBalance) {
      // Reverter: tirar o loosePiecesAfter atual e colocar de volta o loosePiecesBefore
      const newBalance = currentBalance.pieces - palletization.loosePiecesAfter + palletization.loosePiecesBefore
      await tx.loosePiecesBalance.update({
        where: { productId: palletization.productId },
        data: { pieces: Math.max(0, newBalance) },
      })
    }

    // 2. Deletar InventoryMovement vinculado
    await tx.inventoryMovement.deleteMany({
      where: { palletizationId: id },
    })

    // 3. Deletar a paletização
    await tx.palletization.delete({
      where: { id },
    })
  })

  revalidatePath('/paletizacao')
  revalidatePath('/estoque')
  revalidatePath('/dash/cadeia')
}

export async function formPalletFromLoose(productId: string) {
  const recipe = await prisma.costRecipe.findUnique({
    where: { productId },
    select: { piecesPerPallet: true, piecesPerM2: true },
  })

  if (!recipe?.piecesPerPallet) {
    throw new Error('Produto não possui receita com peças por pallet definido')
  }

  const balance = await prisma.loosePiecesBalance.findUnique({
    where: { productId },
  })

  if (!balance || balance.pieces < recipe.piecesPerPallet) {
    throw new Error(`Peças soltas insuficientes. Necessário: ${recipe.piecesPerPallet}, disponível: ${balance?.pieces || 0}`)
  }

  const areaM2 = recipe.piecesPerM2 ? recipe.piecesPerPallet / recipe.piecesPerM2 : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.$transaction(async (tx) => {
    // Criar InventoryMovement
    await tx.inventoryMovement.create({
      data: {
        productId,
        date: today,
        type: 'IN',
        quantityPieces: recipe.piecesPerPallet!,
        quantityPallets: 1,
        areaM2,
        notes: `Pallet formado com peças soltas`,
      },
    })

    // Atualizar saldo
    await tx.loosePiecesBalance.update({
      where: { productId },
      data: { pieces: balance.pieces - recipe.piecesPerPallet! },
    })
  })

  revalidatePath('/paletizacao')
  revalidatePath('/estoque')
  revalidatePath('/dash/cadeia')
}
