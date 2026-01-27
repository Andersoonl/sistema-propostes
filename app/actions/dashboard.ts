'use server'

import { prisma } from '@/lib/prisma'
import { getShiftMinutes, DEFAULT_SHIFTS } from '@/lib/shift'

interface MonthlyProductionData {
  date: string
  VP1: number
  VP2: number
  HZEN: number
  total: number
}

export async function getMonthlyProductionData(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

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
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = date.toISOString().split('T')[0]
    dataByDate[dateStr] = {
      date: dateStr,
      VP1: 0,
      VP2: 0,
      HZEN: 0,
      total: 0,
    }
  }

  // Preencher com dados reais
  for (const pd of productionDays) {
    const dateStr = pd.date.toISOString().split('T')[0]
    const totalCycles = pd.productionItems.reduce((sum, item) => sum + item.cycles, 0)
    const machineName = pd.machine.name as 'VP1' | 'VP2' | 'HZEN'

    if (dataByDate[dateStr] && machineName in dataByDate[dateStr]) {
      dataByDate[dateStr][machineName] = totalCycles
      dataByDate[dateStr].total += totalCycles
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
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

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

  // Agrupar por NV1/NV2/NV3
  const groupedData: Record<string, MonthlyDowntimeData> = {}

  for (const event of downtimeEvents) {
    const nv3 = event.reason
    const nv2 = nv3.parent
    const nv1 = nv2?.parent

    const key = `${nv1?.name || 'N/A'}|${nv2?.name || 'N/A'}|${nv3.name}`

    if (!groupedData[key]) {
      groupedData[key] = {
        reasonNV1: nv1?.name || 'N/A',
        reasonNV2: nv2?.name || 'N/A',
        reasonNV3: nv3.name,
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
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

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

  // Agrupar pelo nível especificado
  const groupedByReason: Record<string, number> = {}

  for (const event of downtimeEvents) {
    let reasonName: string

    if (level === 3) {
      reasonName = event.reason.name
    } else if (level === 2) {
      reasonName = event.reason.parent?.name || 'N/A'
    } else {
      reasonName = event.reason.parent?.parent?.name || 'N/A'
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
  downtimeMinutes: number
  availableMinutes: number
}

export async function getMonthlySummary(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const machines = await prisma.machine.findMany()

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

  const summaries: DailySummary[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()

    for (const machine of machines) {
      const key = `${machine.id}|${dateStr}`
      const override = overrideMap.get(key)
      const shiftMinutes = getShiftMinutes(date, override)

      const pd = productionDays.find(
        (p) => p.machineId === machine.id && p.date.toISOString().split('T')[0] === dateStr
      )

      const productionCycles = pd?.productionItems.reduce((sum, item) => sum + item.cycles, 0) || 0
      const downtimeMinutes = pd?.downtimeEvents.reduce((sum, e) => sum + e.durationMinutes, 0) || 0

      summaries.push({
        date: dateStr,
        dayOfWeek,
        machineId: machine.id,
        machineName: machine.name,
        shiftMinutes,
        productionCycles,
        downtimeMinutes,
        availableMinutes: Math.max(0, shiftMinutes - downtimeMinutes),
      })
    }
  }

  return summaries
}
