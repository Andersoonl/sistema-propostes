'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getDowntimeReasons() {
  return prisma.downtimeReason.findMany({
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
    include: {
      parent: {
        include: { parent: true },
      },
      children: true,
    },
  })
}

export async function getReasonHierarchy() {
  // Buscar apenas NV1 (raízes) e incluir a hierarquia
  const nv1Reasons = await prisma.downtimeReason.findMany({
    where: { level: 1 },
    orderBy: { name: 'asc' },
    include: {
      children: {
        orderBy: { name: 'asc' },
        include: {
          children: {
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  })

  return nv1Reasons
}

export async function getNV3Reasons() {
  return prisma.downtimeReason.findMany({
    where: { level: 3 },
    orderBy: { name: 'asc' },
    include: {
      parent: {
        include: { parent: true },
      },
    },
  })
}

interface CreateReasonInput {
  name: string
  level: number
  parentId?: string
}

export async function createReason(input: CreateReasonInput) {
  // Validação: NV1 não tem parent
  if (input.level === 1 && input.parentId) {
    throw new Error('Motivo NV1 não pode ter pai')
  }

  // Validação: NV2 e NV3 precisam de parent
  if ((input.level === 2 || input.level === 3) && !input.parentId) {
    throw new Error(`Motivo NV${input.level} precisa de um pai`)
  }

  // Validação: parent deve ser do nível correto
  if (input.parentId) {
    const parent = await prisma.downtimeReason.findUnique({
      where: { id: input.parentId },
    })

    if (!parent) {
      throw new Error('Motivo pai não encontrado')
    }

    if (parent.level !== input.level - 1) {
      throw new Error(`Motivo NV${input.level} deve ter pai NV${input.level - 1}`)
    }
  }

  const reason = await prisma.downtimeReason.create({
    data: {
      name: input.name,
      level: input.level,
      parentId: input.parentId,
    },
  })

  revalidatePath('/dia')

  return reason
}
