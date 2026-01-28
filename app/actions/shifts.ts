'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SHIFTS } from '@/lib/shift'

export interface ShiftData {
  dayOfWeek: number
  startTime: string
  endTime: string
  breakMinutes: number
}

export interface MachineShiftData extends ShiftData {
  id?: string
  machineId: string
}

// Buscar turnos de uma máquina (com fallback para padrão)
export async function getMachineShifts(machineId: string): Promise<MachineShiftData[]> {
  const shifts = await prisma.machineShift.findMany({
    where: { machineId },
    orderBy: { dayOfWeek: 'asc' },
  })

  // Criar array com todos os dias, usando valores do banco ou padrão
  const result: MachineShiftData[] = []
  for (let day = 0; day <= 6; day++) {
    const dbShift = shifts.find(s => s.dayOfWeek === day)
    if (dbShift) {
      result.push({
        id: dbShift.id,
        machineId: dbShift.machineId,
        dayOfWeek: dbShift.dayOfWeek,
        startTime: dbShift.startTime,
        endTime: dbShift.endTime,
        breakMinutes: dbShift.breakMinutes,
      })
    } else {
      const defaultShift = DEFAULT_SHIFTS[day]
      result.push({
        machineId,
        dayOfWeek: day,
        startTime: defaultShift.startTime,
        endTime: defaultShift.endTime,
        breakMinutes: defaultShift.breakMinutes,
      })
    }
  }

  return result
}

// Buscar turno específico de uma máquina para um dia
export async function getMachineShiftForDay(
  machineId: string,
  dayOfWeek: number
): Promise<ShiftData> {
  const shift = await prisma.machineShift.findUnique({
    where: {
      machineId_dayOfWeek: { machineId, dayOfWeek },
    },
  })

  if (shift) {
    return {
      dayOfWeek: shift.dayOfWeek,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
    }
  }

  // Fallback para padrão
  return {
    dayOfWeek,
    ...DEFAULT_SHIFTS[dayOfWeek],
  }
}

// Salvar turnos de uma máquina
export async function saveMachineShifts(
  machineId: string,
  shifts: ShiftData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Usar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      for (const shift of shifts) {
        await tx.machineShift.upsert({
          where: {
            machineId_dayOfWeek: { machineId, dayOfWeek: shift.dayOfWeek },
          },
          update: {
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes,
          },
          create: {
            machineId,
            dayOfWeek: shift.dayOfWeek,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes,
          },
        })
      }
    })

    revalidatePath('/turnos')
    revalidatePath('/dia')
    return { success: true }
  } catch (error) {
    console.error('Erro ao salvar turnos:', error)
    return { success: false, error: 'Erro ao salvar turnos' }
  }
}

// Resetar turnos de uma máquina para o padrão
export async function resetMachineShifts(
  machineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.machineShift.deleteMany({
      where: { machineId },
    })

    revalidatePath('/turnos')
    revalidatePath('/dia')
    return { success: true }
  } catch (error) {
    console.error('Erro ao resetar turnos:', error)
    return { success: false, error: 'Erro ao resetar turnos' }
  }
}

// Buscar todas as máquinas com seus turnos
export async function getAllMachinesWithShifts() {
  const machines = await prisma.machine.findMany({
    include: {
      shifts: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return machines.map((machine) => ({
    id: machine.id,
    name: machine.name,
    shifts: Array.from({ length: 7 }, (_, day) => {
      const dbShift = machine.shifts.find((s) => s.dayOfWeek === day)
      if (dbShift) {
        return {
          id: dbShift.id,
          dayOfWeek: dbShift.dayOfWeek,
          startTime: dbShift.startTime,
          endTime: dbShift.endTime,
          breakMinutes: dbShift.breakMinutes,
          isCustom: true,
        }
      }
      const defaultShift = DEFAULT_SHIFTS[day]
      return {
        dayOfWeek: day,
        startTime: defaultShift.startTime,
        endTime: defaultShift.endTime,
        breakMinutes: defaultShift.breakMinutes,
        isCustom: false,
      }
    }),
  }))
}
