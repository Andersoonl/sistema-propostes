'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ==================== MOVIMENTAÇÕES ====================

interface CreateMovementInput {
  productId: string
  date: Date
  type: 'OUT'  // IN é criado automaticamente via produção
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
  // Não permitir excluir movimentações automáticas (IN com productionDayId)
  const movement = await prisma.inventoryMovement.findUnique({
    where: { id },
  })

  if (!movement) {
    throw new Error('Movimentação não encontrada')
  }

  if (movement.type === 'IN' && movement.productionDayId) {
    throw new Error('Movimentações de produção não podem ser excluídas manualmente. Edite o lançamento de produção.')
  }

  await prisma.inventoryMovement.delete({
    where: { id },
  })

  revalidatePath('/estoque')
}

// ==================== CONSULTA DE ESTOQUE ====================

interface ProductStockItem {
  productId: string
  productName: string
  totalIn: number
  totalOut: number
  balancePieces: number
  balancePallets: number | null
  balanceM2: number | null
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

  const movements = await prisma.inventoryMovement.findMany({
    orderBy: { date: 'desc' },
  })

  // Agrupar movimentações por produto
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

  return products.map((product) => {
    const data = movementMap.get(product.id) || { totalIn: 0, totalOut: 0, lastDate: null }
    const balancePieces = data.totalIn - data.totalOut

    const balancePallets = product.costRecipe?.piecesPerPallet
      ? Math.round((balancePieces / product.costRecipe.piecesPerPallet) * 10) / 10
      : null
    const balanceM2 = product.costRecipe?.piecesPerM2
      ? Math.round((balancePieces / product.costRecipe.piecesPerM2) * 10) / 10
      : null

    return {
      productId: product.id,
      productName: product.name,
      totalIn: data.totalIn,
      totalOut: data.totalOut,
      balancePieces,
      balancePallets,
      balanceM2,
      lastMovementDate: data.lastDate?.toISOString().split('T')[0] || null,
    }
  }).filter((p) => p.totalIn > 0 || p.totalOut > 0)
}
