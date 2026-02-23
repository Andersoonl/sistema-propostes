'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getMachines() {
  return prisma.machine.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getProducts() {
  return prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { subcategory: 'asc' }, { name: 'asc' }],
  })
}

export async function getProductionDay(machineId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  return prisma.productionDay.findUnique({
    where: {
      machineId_date: {
        machineId,
        date: startOfDay,
      },
    },
    include: {
      machine: true,
      productionItems: {
        include: { product: true },
      },
      downtimeEvents: {
        include: {
          reason: {
            include: {
              parent: {
                include: { parent: true },
              },
            },
          },
        },
      },
    },
  })
}

export async function getProductionDays(date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  return prisma.productionDay.findMany({
    where: { date: startOfDay },
    include: {
      machine: true,
      productionItems: {
        include: { product: true },
      },
      downtimeEvents: {
        include: { reason: true },
      },
    },
  })
}

interface SaveProductionDayInput {
  machineId: string
  date: Date
  hasProductSwap: boolean
  notes?: string
  items: {
    productId: string
    cycles: number
    startTime?: string
    endTime?: string
  }[]
}

export async function saveProductionDay(input: SaveProductionDayInput) {
  const startOfDay = new Date(input.date)
  startOfDay.setHours(0, 0, 0, 0)

  // Validação: máximo 2 produtos por dia
  if (input.items.length > 2) {
    throw new Error('Máximo de 2 produtos por dia por máquina')
  }

  const productionDay = await prisma.productionDay.upsert({
    where: {
      machineId_date: {
        machineId: input.machineId,
        date: startOfDay,
      },
    },
    update: {
      hasProductSwap: input.hasProductSwap,
      notes: input.notes,
    },
    create: {
      machineId: input.machineId,
      date: startOfDay,
      hasProductSwap: input.hasProductSwap,
      notes: input.notes,
    },
  })

  // Deletar items antigos e criar novos
  await prisma.productionItem.deleteMany({
    where: { productionDayId: productionDay.id },
  })

  // Buscar receitas dos produtos para calcular peças, pallets, m²
  const productIds = input.items.map((item) => item.productId)
  const recipes = await prisma.costRecipe.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      piecesPerCycle: true,
      piecesPerPallet: true,
      piecesPerM2: true,
      m2PerPallet: true,
      cyclesPerBatch: true,
    },
  })
  const recipeMap = new Map(recipes.map((r) => [r.productId, r]))

  for (const item of input.items) {
    const recipe = recipeMap.get(item.productId)
    const pieces = recipe ? item.cycles * recipe.piecesPerCycle : null
    const areaM2 = pieces && recipe?.piecesPerM2 ? pieces / recipe.piecesPerM2 : null
    // Pallets: usar m2PerPallet (pisos) ou piecesPerPallet (blocos)
    let pallets: number | null = null
    if (recipe?.m2PerPallet && areaM2) {
      pallets = areaM2 / recipe.m2PerPallet
    } else if (recipe?.piecesPerPallet && pieces) {
      pallets = pieces / recipe.piecesPerPallet
    }

    await prisma.productionItem.create({
      data: {
        productionDayId: productionDay.id,
        productId: item.productId,
        cycles: item.cycles,
        pieces,
        pallets,
        areaM2,
        startTime: item.startTime,
        endTime: item.endTime,
      },
    })
  }

  // Criar movimentações de estoque (Fase 3 - Estoque PA)
  // Deletar movimentações anteriores deste dia de produção para evitar duplicação
  await prisma.inventoryMovement.deleteMany({
    where: { productionDayId: productionDay.id },
  })

  for (const item of input.items) {
    const recipe = recipeMap.get(item.productId)
    const pieces = recipe ? item.cycles * recipe.piecesPerCycle : item.cycles
    const areaM2 = pieces && recipe?.piecesPerM2 ? pieces / recipe.piecesPerM2 : null
    let invPallets: number | null = null
    if (recipe?.m2PerPallet && areaM2) {
      invPallets = areaM2 / recipe.m2PerPallet
    } else if (recipe?.piecesPerPallet && pieces) {
      invPallets = pieces / recipe.piecesPerPallet
    }

    if (pieces > 0) {
      await prisma.inventoryMovement.create({
        data: {
          productId: item.productId,
          date: startOfDay,
          type: 'IN',
          quantityPieces: pieces,
          quantityPallets: invPallets,
          areaM2,
          productionDayId: productionDay.id,
          notes: `Produção automática - ${item.cycles} ciclos`,
        },
      })
    }
  }

  revalidatePath('/dia')
  revalidatePath('/dash/producao')
  revalidatePath('/estoque')

  return productionDay
}

interface SaveDowntimeEventInput {
  productionDayId: string
  reasonId: string
  durationMinutes: number
  notes?: string
}

export async function saveDowntimeEvent(input: SaveDowntimeEventInput) {
  // Validação: motivo (reasonId) é obrigatório
  if (!input.reasonId) {
    throw new Error('Motivo da parada é obrigatório')
  }

  // Validação: duração deve ser positiva
  if (input.durationMinutes <= 0) {
    throw new Error('Duração deve ser maior que zero')
  }

  // Validação: motivo deve existir (pode ser NV1, NV2 ou NV3)
  const reason = await prisma.downtimeReason.findUnique({
    where: { id: input.reasonId },
  })

  if (!reason) {
    throw new Error('Motivo não encontrado')
  }

  const event = await prisma.downtimeEvent.create({
    data: {
      productionDayId: input.productionDayId,
      reasonId: input.reasonId,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    },
  })

  revalidatePath('/dia')
  revalidatePath('/dash/producao')

  return event
}

export async function deleteDowntimeEvent(id: string) {
  await prisma.downtimeEvent.delete({
    where: { id },
  })

  revalidatePath('/dia')
  revalidatePath('/dash/producao')
}

export async function createProduct(name: string, category?: string, subcategory?: string) {
  const product = await prisma.product.create({
    data: { name, category, subcategory },
  })

  revalidatePath('/dia')
  revalidatePath('/produtos')

  return product
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id },
  })

  revalidatePath('/dia')
  revalidatePath('/produtos')
}
