'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { vehicleSchema, type VehicleInput } from '@/lib/validators/vehicle'
import type { VehicleStatus, Prisma } from '@/app/generated/prisma/client'

// ===== Tipos =====

export interface VehiclePaginationParams {
  page: number
  pageSize: number
  search?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ===== Listagem paginada =====

export async function getVehiclesPaginated(params: VehiclePaginationParams) {
  const { page, pageSize, search, status, sortBy, sortOrder } = params

  const where: Prisma.VehicleWhereInput = {}

  if (status && status !== 'ALL') {
    where.status = status as VehicleStatus
  }

  if (search) {
    where.OR = [
      { plate: { contains: search.toUpperCase() } },
      { description: { contains: search } },
    ]
  }

  let orderBy: Prisma.VehicleOrderByWithRelationInput = { plate: 'asc' }
  if (sortBy) {
    switch (sortBy) {
      case 'plate':
        orderBy = { plate: sortOrder || 'asc' }
        break
      case 'description':
        orderBy = { description: sortOrder || 'asc' }
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { deliveries: true } },
      },
    }),
    prisma.vehicle.count({ where }),
  ])

  return {
    data: data.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ===== Todos ativos (para dropdown) =====

export async function getAllActiveVehicles() {
  return prisma.vehicle.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, plate: true, description: true },
    orderBy: { plate: 'asc' },
  })
}

// ===== Criar =====

export async function createVehicle(data: VehicleInput) {
  const parsed = vehicleSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { plate, description, capacity } = parsed.data

  // Verificar placa única
  const existing = await prisma.vehicle.findUnique({ where: { plate } })
  if (existing) {
    throw new Error('Já existe um veículo com esta placa')
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      plate,
      description: description || null,
      capacity: capacity || null,
    },
  })

  revalidatePath('/logistica/veiculos')
  return vehicle
}

// ===== Atualizar =====

export async function updateVehicle(id: string, data: VehicleInput) {
  const parsed = vehicleSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { plate, description, capacity } = parsed.data

  // Verificar placa única (exceto o próprio)
  const existing = await prisma.vehicle.findFirst({
    where: { plate, id: { not: id } },
  })
  if (existing) {
    throw new Error('Já existe outro veículo com esta placa')
  }

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      plate,
      description: description || null,
      capacity: capacity || null,
    },
  })

  revalidatePath('/logistica/veiculos')
  return vehicle
}

// ===== Excluir =====

export async function deleteVehicle(id: string) {
  const deliveryCount = await prisma.delivery.count({ where: { vehicleId: id } })
  if (deliveryCount > 0) {
    throw new Error('Este veículo possui entregas vinculadas. Inative-o em vez de excluir.')
  }

  await prisma.vehicle.delete({ where: { id } })
  revalidatePath('/logistica/veiculos')
}

// ===== Toggle status =====

export async function toggleVehicleStatus(id: string) {
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id } })
  const newStatus: VehicleStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  await prisma.vehicle.update({
    where: { id },
    data: { status: newStatus },
  })

  revalidatePath('/logistica/veiculos')
}
