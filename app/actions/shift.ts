'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getShiftOverride(machineId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  return prisma.shiftOverride.findUnique({
    where: {
      machineId_date: {
        machineId,
        date: startOfDay,
      },
    },
  })
}

interface SaveShiftOverrideInput {
  machineId: string
  date: Date
  startTime: string
  endTime: string
  breakMinutes: number
}

export async function saveShiftOverride(input: SaveShiftOverrideInput) {
  const startOfDay = new Date(input.date)
  startOfDay.setHours(0, 0, 0, 0)

  const override = await prisma.shiftOverride.upsert({
    where: {
      machineId_date: {
        machineId: input.machineId,
        date: startOfDay,
      },
    },
    update: {
      startTime: input.startTime,
      endTime: input.endTime,
      breakMinutes: input.breakMinutes,
    },
    create: {
      machineId: input.machineId,
      date: startOfDay,
      startTime: input.startTime,
      endTime: input.endTime,
      breakMinutes: input.breakMinutes,
    },
  })

  revalidatePath('/dia')
  revalidatePath('/dash/producao')

  return override
}

export async function deleteShiftOverride(machineId: string, date: Date) {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  await prisma.shiftOverride.delete({
    where: {
      machineId_date: {
        machineId,
        date: startOfDay,
      },
    },
  })

  revalidatePath('/dia')
  revalidatePath('/dash/producao')
}
