'use server'

import { prisma } from '@/lib/prisma'
import { DEFAULT_SHIFTS } from '@/lib/shift'

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
  downtimeMinutes: number
  availableMinutes: number
}

function calculateShiftMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  if (startTime === endTime) return 0
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  return Math.max(0, totalMinutes - breakMinutes)
}

export async function getMonthlySummary(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

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
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()

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
