'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { driverSchema, type DriverInput } from '@/lib/validators/driver'
import type { DriverStatus, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface DriverPaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ===== Listagem paginada =====

export async function getDriversPaginated(params: DriverPaginationParams) {
  const { page, pageSize, search, status, sortBy, sortOrder } = params

  const where: Prisma.DriverWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as DriverStatus
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { document: { contains: search } },
      { phone: { contains: search } },
    ]
  }

  let orderBy: Prisma.DriverOrderByWithRelationInput = { name: 'asc' }
  if (sortBy) {
    switch (sortBy) {
      case 'name':
        orderBy = { name: sortOrder || 'asc' }
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { deliveries: true } },
      },
    }),
    prisma.driver.count({ where }),
  ])

  return {
    data: data.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== Todos ativos (para dropdown) =====

export async function getAllActiveDrivers() {
  return prisma.driver.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

// ===== Criar =====

export async function createDriver(data: DriverInput) {
  const parsed = driverSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { name, document, phone, license } = parsed.data

  const driver = await prisma.driver.create({
    data: {
      name,
      document: document || null,
      phone: phone || null,
      license: license || null,
    },
  })

  revalidatePath('/logistica/motoristas')
  return driver
}

// ===== Atualizar =====

export async function updateDriver(id: string, data: DriverInput) {
  const parsed = driverSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { name, document, phone, license } = parsed.data

  const driver = await prisma.driver.update({
    where: { id },
    data: {
      name,
      document: document || null,
      phone: phone || null,
      license: license || null,
    },
  })

  revalidatePath('/logistica/motoristas')
  return driver
}

// ===== Excluir =====

export async function deleteDriver(id: string) {
  const deliveryCount = await prisma.delivery.count({ where: { driverId: id } })
  if (deliveryCount > 0) {
    throw new Error('Este motorista possui entregas vinculadas. Inative-o em vez de excluir.')
  }

  await prisma.driver.delete({ where: { id } })
  revalidatePath('/logistica/motoristas')
}

// ===== Toggle status =====

export async function toggleDriverStatus(id: string) {
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id } })
  const newStatus: DriverStatus = driver.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  await prisma.driver.update({
    where: { id },
    data: { status: newStatus },
  })

  revalidatePath('/logistica/motoristas')
}
