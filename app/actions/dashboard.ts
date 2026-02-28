'use server'

import { prisma } from '@/lib/prisma'
import { DEFAULT_SHIFTS } from '@/lib/shift'

interface MonthlyProductionData {
  date: string
  VP1: number
  VP2: number
  HZEN: number
  total: number
  VP1Pieces: number
  VP2Pieces: number
  HZENPieces: number
  totalPieces: number
  VP1Pallets: number
  VP2Pallets: number
  HZENPallets: number
  totalPallets: number
  VP1M2: number
  VP2M2: number
  HZENM2: number
  totalM2: number
  hasProduction: boolean
}

export async function getMonthlyProductionData(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const productionDays = await prisma.productionDay.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      machine: true,
      productionItems: true,
    },
    orderBy: { date: 'asc' },
  })

  // Agrupar por data
  const dataByDate: Record<string, MonthlyProductionData> = {}

  // Inicializar todos os dias do mês
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day))
    const dateStr = date.toISOString().split('T')[0]
    dataByDate[dateStr] = {
      date: dateStr,
      VP1: 0,
      VP2: 0,
      HZEN: 0,
      total: 0,
      VP1Pieces: 0,
      VP2Pieces: 0,
      HZENPieces: 0,
      totalPieces: 0,
      VP1Pallets: 0,
      VP2Pallets: 0,
      HZENPallets: 0,
      totalPallets: 0,
      VP1M2: 0,
      VP2M2: 0,
      HZENM2: 0,
      totalM2: 0,
      hasProduction: false,
    }
  }

  // Preencher com dados reais
  for (const pd of productionDays) {
    const dateStr = pd.date.toISOString().split('T')[0]
    const totalCycles = pd.productionItems.reduce((sum, item) => sum + item.cycles, 0)
    const totalPieces = pd.productionItems.reduce((sum, item) => sum + (item.pieces || 0), 0)
    const totalPallets = pd.productionItems.reduce((sum, item) => sum + (item.pallets || 0), 0)
    const totalM2 = pd.productionItems.reduce((sum, item) => sum + (item.areaM2 || 0), 0)
    const machineName = pd.machine.name as 'VP1' | 'VP2' | 'HZEN'

    if (dataByDate[dateStr] && machineName in dataByDate[dateStr]) {
      dataByDate[dateStr][machineName] = totalCycles
      dataByDate[dateStr][`${machineName}Pieces` as 'VP1Pieces' | 'VP2Pieces' | 'HZENPieces'] = totalPieces
      dataByDate[dateStr][`${machineName}Pallets` as 'VP1Pallets' | 'VP2Pallets' | 'HZENPallets'] = totalPallets
      dataByDate[dateStr][`${machineName}M2` as 'VP1M2' | 'VP2M2' | 'HZENM2'] = totalM2
      dataByDate[dateStr].total += totalCycles
      dataByDate[dateStr].totalPieces += totalPieces
      dataByDate[dateStr].totalPallets += totalPallets
      dataByDate[dateStr].totalM2 += totalM2
      dataByDate[dateStr].hasProduction = true
    }
  }

  return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date))
}

interface MonthlyDowntimeData {
  reasonNV1: string
  reasonNV2: string
  reasonNV3: string
  totalMinutes: number
  count: number
}

export async function getMonthlyDowntimeData(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const downtimeEvents = await prisma.downtimeEvent.findMany({
    where: {
      productionDay: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      reason: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
      productionDay: {
        include: { machine: true },
      },
    },
  })

  // Agrupar por NV1/NV2/NV3 (motivo pode ter sido registrado em qualquer nível)
  const groupedData: Record<string, MonthlyDowntimeData> = {}

  for (const event of downtimeEvents) {
    const reason = event.reason
    let nv1Name = '-'
    let nv2Name = '-'
    let nv3Name = '-'

    if (reason.level === 1) {
      nv1Name = reason.name
    } else if (reason.level === 2) {
      nv1Name = reason.parent?.name || '-'
      nv2Name = reason.name
    } else if (reason.level === 3) {
      nv1Name = reason.parent?.parent?.name || '-'
      nv2Name = reason.parent?.name || '-'
      nv3Name = reason.name
    }

    const key = `${nv1Name}|${nv2Name}|${nv3Name}`

    if (!groupedData[key]) {
      groupedData[key] = {
        reasonNV1: nv1Name,
        reasonNV2: nv2Name,
        reasonNV3: nv3Name,
        totalMinutes: 0,
        count: 0,
      }
    }

    groupedData[key].totalMinutes += event.durationMinutes
    groupedData[key].count += 1
  }

  return Object.values(groupedData).sort((a, b) => b.totalMinutes - a.totalMinutes)
}

interface ParetoData {
  reason: string
  minutes: number
  percentage: number
  cumulativePercentage: number
}

export async function getDowntimePareto(
  year: number,
  month: number,
  level: 1 | 2 | 3 = 3
): Promise<ParetoData[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const downtimeEvents = await prisma.downtimeEvent.findMany({
    where: {
      productionDay: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      reason: {
        include: {
          parent: {
            include: { parent: true },
          },
        },
      },
    },
  })

  // Agrupar pelo nível especificado (motivo pode ter sido registrado em qualquer nível)
  const groupedByReason: Record<string, number> = {}

  for (const event of downtimeEvents) {
    const reason = event.reason
    let reasonName: string

    if (level === 1) {
      // Buscar NV1: subir até a raiz
      if (reason.level === 1) reasonName = reason.name
      else if (reason.level === 2) reasonName = reason.parent?.name || reason.name
      else reasonName = reason.parent?.parent?.name || reason.parent?.name || reason.name
    } else if (level === 2) {
      // Buscar NV2: se o motivo não tem NV2, usa o próprio nome
      if (reason.level === 1) reasonName = reason.name
      else if (reason.level === 2) reasonName = reason.name
      else reasonName = reason.parent?.name || reason.name
    } else {
      // Buscar NV3: se o motivo não tem NV3, usa o próprio nome
      reasonName = reason.level === 3 ? reason.name : reason.name
    }

    groupedByReason[reasonName] = (groupedByReason[reasonName] || 0) + event.durationMinutes
  }

  // Ordenar por minutos (decrescente)
  const sorted = Object.entries(groupedByReason)
    .map(([reason, minutes]) => ({ reason, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  // Calcular percentuais e acumulado
  const totalMinutes = sorted.reduce((sum, item) => sum + item.minutes, 0)
  let cumulative = 0

  return sorted.map((item) => {
    const percentage = totalMinutes > 0 ? (item.minutes / totalMinutes) * 100 : 0
    cumulative += percentage
    return {
      reason: item.reason,
      minutes: item.minutes,
      percentage: Math.round(percentage * 10) / 10,
      cumulativePercentage: Math.round(cumulative * 10) / 10,
    }
  })
}

interface DailySummary {
  date: string
  dayOfWeek: number
  machineId: string
  machineName: string
  shiftMinutes: number
  productionCycles: number
  productionPieces: number
  downtimeMinutes: number
  availableMinutes: number
  hasProduction: boolean // indica se houve lançamento neste dia/máquina
}

function calculateShiftMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  if (startTime === endTime) return 0
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  return Math.max(0, totalMinutes - breakMinutes)
}

interface ProductPiecesSummary {
  productId: string
  productName: string
  totalCycles: number
  totalPieces: number
  totalPallets: number
  totalM2: number
  machineBreakdown: {
    machineName: string
    cycles: number
    pieces: number
  }[]
}

export async function getMonthlyProductPiecesSummary(year: number, month: number): Promise<ProductPiecesSummary[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

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
      product: true,
      productionDay: {
        include: {
          machine: true,
        },
      },
    },
  })

  // Agrupar por produto
  const productMap = new Map<string, {
    productId: string
    productName: string
    totalCycles: number
    totalPieces: number
    totalPallets: number
    totalM2: number
    machineData: Map<string, { machineName: string; cycles: number; pieces: number }>
  }>()

  for (const item of productionItems) {
    const productId = item.productId
    const productName = item.product.name
    const machineName = item.productionDay.machine.name

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName,
        totalCycles: 0,
        totalPieces: 0,
        totalPallets: 0,
        totalM2: 0,
        machineData: new Map(),
      })
    }

    const productData = productMap.get(productId)!
    productData.totalCycles += item.cycles
    productData.totalPieces += item.pieces || 0
    productData.totalPallets += item.pallets || 0
    productData.totalM2 += item.areaM2 || 0

    if (!productData.machineData.has(machineName)) {
      productData.machineData.set(machineName, { machineName, cycles: 0, pieces: 0 })
    }
    const machineEntry = productData.machineData.get(machineName)!
    machineEntry.cycles += item.cycles
    machineEntry.pieces += item.pieces || 0
  }

  // Converter para array e ordenar por peças (decrescente)
  return Array.from(productMap.values())
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      totalCycles: p.totalCycles,
      totalPieces: p.totalPieces,
      totalPallets: Math.round(p.totalPallets * 10) / 10,
      totalM2: Math.round(p.totalM2 * 10) / 10,
      machineBreakdown: Array.from(p.machineData.values()).sort((a, b) => b.pieces - a.pieces),
    }))
    .sort((a, b) => b.totalPieces - a.totalPieces)
}

export async function getMonthlySummary(year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const machines = await prisma.machine.findMany({
    include: {
      shifts: true,
    },
  })

  const productionDays = await prisma.productionDay.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      machine: true,
      productionItems: true,
      downtimeEvents: true,
    },
  })

  const shiftOverrides = await prisma.shiftOverride.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  const overrideMap = new Map<string, typeof shiftOverrides[0]>()
  for (const so of shiftOverrides) {
    const key = `${so.machineId}|${so.date.toISOString().split('T')[0]}`
    overrideMap.set(key, so)
  }

  // Criar mapa de turnos por máquina e dia da semana
  const machineShiftMap = new Map<string, { startTime: string; endTime: string; breakMinutes: number }>()
  for (const machine of machines) {
    for (const shift of machine.shifts) {
      machineShiftMap.set(`${machine.id}|${shift.dayOfWeek}`, {
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
      })
    }
  }

  const summaries: DailySummary[] = []
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day))
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getUTCDay()

    for (const machine of machines) {
      const key = `${machine.id}|${dateStr}`
      const override = overrideMap.get(key)

      let shiftMinutes: number
      if (override) {
        // Usar override se existir
        shiftMinutes = calculateShiftMinutes(override.startTime, override.endTime, override.breakMinutes)
      } else {
        // Verificar turno customizado da máquina
        const machineShift = machineShiftMap.get(`${machine.id}|${dayOfWeek}`)
        if (machineShift) {
          shiftMinutes = calculateShiftMinutes(machineShift.startTime, machineShift.endTime, machineShift.breakMinutes)
        } else {
          // Usar padrão global
          const defaultShift = DEFAULT_SHIFTS[dayOfWeek]
          shiftMinutes = calculateShiftMinutes(defaultShift.startTime, defaultShift.endTime, defaultShift.breakMinutes)
        }
      }

      const pd = productionDays.find(
        (p) => p.machineId === machine.id && p.date.toISOString().split('T')[0] === dateStr
      )

      const productionCycles = pd?.productionItems.reduce((sum, item) => sum + item.cycles, 0) || 0
      const productionPieces = pd?.productionItems.reduce((sum, item) => sum + (item.pieces || 0), 0) || 0
      const downtimeMinutes = pd?.downtimeEvents.reduce((sum, e) => sum + e.durationMinutes, 0) || 0

      summaries.push({
        date: dateStr,
        dayOfWeek,
        machineId: machine.id,
        machineName: machine.name,
        shiftMinutes,
        productionCycles,
        productionPieces,
        downtimeMinutes,
        availableMinutes: Math.max(0, shiftMinutes - downtimeMinutes),
        hasProduction: !!pd, // true se existe ProductionDay (lançamento) neste dia/máquina
      })
    }
  }

  return summaries
}

// ==================== CADEIA PRODUTIVA ====================

interface ProductionChainSummary {
  // Matéria Prima
  materialConsumption: {
    ingredientName: string
    unit: string
    totalConsumed: number
    totalCost: number
  }[]
  totalMaterialCost: number

  // Produção
  totalBatches: number
  totalCycles: number
  totalPieces: number
  totalPallets: number
  totalM2: number

  // Por Máquina
  byMachine: {
    machineName: string
    cycles: number
    pieces: number
    pallets: number
    m2: number
  }[]

  // Paletização
  palletizedPieces: number
  palletizedPallets: number
  palletizedM2: number
  lossPieces: number
  lossPct: number

  // Estoque PA
  stockAvailablePieces: number
  stockCuringPieces: number
  stockLoosePieces: number
  stockPieces: number
  stockPallets: number
  stockM2: number
}

export async function getProductionChainSummary(year: number, month: number): Promise<ProductionChainSummary> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  // Buscar itens de produção do mês
  const productionItems = await prisma.productionItem.findMany({
    where: {
      productionDay: {
        date: { gte: startDate, lte: endDate },
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
      productionDay: {
        include: { machine: true },
      },
    },
  })

  // Calcular consumo de MP
  const materialMap = new Map<string, { ingredientName: string; unit: string; totalConsumed: number; totalCost: number }>()

  let totalBatches = 0
  let totalCycles = 0
  let totalPieces = 0
  let totalPallets = 0
  let totalM2 = 0

  const machineMap = new Map<string, { machineName: string; cycles: number; pieces: number; pallets: number; m2: number }>()

  for (const item of productionItems) {
    const recipe = item.product.costRecipe
    totalCycles += item.cycles
    totalPieces += item.pieces || 0
    totalPallets += item.pallets || 0
    totalM2 += item.areaM2 || 0

    const machineName = item.productionDay.machine.name
    const existing = machineMap.get(machineName) || { machineName, cycles: 0, pieces: 0, pallets: 0, m2: 0 }
    existing.cycles += item.cycles
    existing.pieces += item.pieces || 0
    existing.pallets += item.pallets || 0
    existing.m2 += item.areaM2 || 0
    machineMap.set(machineName, existing)

    if (recipe) {
      const batches = item.cycles / recipe.cyclesPerBatch
      totalBatches += batches

      for (const recipeItem of recipe.items) {
        const consumed = batches * recipeItem.quantity
        const cost = consumed * recipeItem.ingredient.unitPrice
        const key = recipeItem.ingredientId
        const mat = materialMap.get(key) || {
          ingredientName: recipeItem.ingredient.name,
          unit: recipeItem.ingredient.unit,
          totalConsumed: 0,
          totalCost: 0,
        }
        mat.totalConsumed += consumed
        mat.totalCost += cost
        materialMap.set(key, mat)
      }
    }
  }

  // Paletização do mês
  const palletizations = await prisma.palletization.findMany({
    where: {
      palletizedDate: { gte: startDate, lte: endDate },
    },
  })

  let palletizedPieces = 0
  let palletizedPallets = 0
  let lossPiecesTotal = 0

  for (const p of palletizations) {
    palletizedPieces += p.realPieces
    palletizedPallets += p.completePallets
    lossPiecesTotal += p.lossPieces
  }

  const palletizedTheoreticalTotal = palletizations.reduce((sum, p) => sum + p.theoreticalPieces + p.loosePiecesBefore, 0)
  const lossPct = palletizedTheoreticalTotal > 0 ? (lossPiecesTotal / palletizedTheoreticalTotal) * 100 : 0

  // Estoque atual
  const allMovements = await prisma.inventoryMovement.findMany()
  let stockPieces = 0
  let stockPallets = 0
  let stockM2 = 0

  for (const mov of allMovements) {
    const sign = mov.type === 'IN' ? 1 : -1
    stockPieces += sign * mov.quantityPieces
    stockPallets += sign * (mov.quantityPallets || 0)
    stockM2 += sign * (mov.areaM2 || 0)
  }

  // Peças em cura (produzidas mas não paletizadas)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existingPalletizations = await prisma.palletization.findMany({
    select: { productId: true, productionDate: true },
  })
  const palletizedSet = new Set(
    existingPalletizations.map(
      (p) => `${p.productId}|${p.productionDate.toISOString().split('T')[0]}`
    )
  )

  const legacyMovements = await prisma.inventoryMovement.findMany({
    where: { type: 'IN', productionDayId: { not: null } },
    select: { productionDayId: true },
  })
  const legacyDayIds = new Set(legacyMovements.map((m) => m.productionDayId!))

  const curingItems = await prisma.productionItem.findMany({
    where: {
      cycles: { gt: 0 },
      productionDay: { date: { lt: today } },
    },
    include: { productionDay: true },
  })

  // Buscar receitas para recalcular peças quando pieces é NULL
  const curingProductIds = [...new Set(curingItems.map((i) => i.productId))]
  const curingRecipes = await prisma.costRecipe.findMany({
    where: { productId: { in: curingProductIds } },
    select: { productId: true, piecesPerCycle: true },
  })
  const curingRecipeMap = new Map(curingRecipes.map((r) => [r.productId, r]))

  let stockCuringPieces = 0
  for (const item of curingItems) {
    const dateStr = item.productionDay.date.toISOString().split('T')[0]
    const key = `${item.productId}|${dateStr}`
    if (!palletizedSet.has(key) && !legacyDayIds.has(item.productionDayId)) {
      const curingRecipe = curingRecipeMap.get(item.productId)
      const pieces = item.pieces ?? (curingRecipe ? item.cycles * curingRecipe.piecesPerCycle : item.cycles)
      stockCuringPieces += pieces
    }
  }

  // Peças soltas
  const looseBalances = await prisma.loosePiecesBalance.findMany()
  const stockLoosePieces = looseBalances.reduce((sum, b) => sum + b.pieces, 0)

  // Calcular m² paletizado
  const palletizedProductIds = [...new Set(palletizations.map((p) => p.productId))]
  const palletRecipes = await prisma.costRecipe.findMany({
    where: { productId: { in: palletizedProductIds } },
    select: { productId: true, piecesPerM2: true },
  })
  const palletRecipeMap = new Map(palletRecipes.map((r) => [r.productId, r]))

  let palletizedM2 = 0
  for (const p of palletizations) {
    const recipe = palletRecipeMap.get(p.productId)
    if (recipe?.piecesPerM2) {
      palletizedM2 += p.realPieces / recipe.piecesPerM2
    }
  }

  const materialConsumption = Array.from(materialMap.values())
    .map((m) => ({
      ...m,
      totalConsumed: Math.round(m.totalConsumed * 100) / 100,
      totalCost: Math.round(m.totalCost * 100) / 100,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)

  return {
    materialConsumption,
    totalMaterialCost: materialConsumption.reduce((sum, m) => sum + m.totalCost, 0),
    totalBatches: Math.round(totalBatches * 10) / 10,
    totalCycles,
    totalPieces,
    totalPallets: Math.round(totalPallets * 10) / 10,
    totalM2: Math.round(totalM2 * 10) / 10,
    byMachine: Array.from(machineMap.values()).map((m) => ({
      ...m,
      pallets: Math.round(m.pallets * 10) / 10,
      m2: Math.round(m.m2 * 10) / 10,
    })),
    palletizedPieces,
    palletizedPallets,
    palletizedM2: Math.round(palletizedM2 * 10) / 10,
    lossPieces: lossPiecesTotal,
    lossPct: Math.round(lossPct * 10) / 10,
    stockAvailablePieces: stockPieces,
    stockCuringPieces,
    stockLoosePieces,
    stockPieces,
    stockPallets: Math.round(stockPallets * 10) / 10,
    stockM2: Math.round(stockM2 * 10) / 10,
  }
}
