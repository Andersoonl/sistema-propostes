'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { supplierSchema, type SupplierInput } from '@/lib/validators/entity'
import { detectDocumentType, onlyDigits } from '@/lib/document'
import type { PaginationParams, PaginatedResult, EntityCounts } from '@/app/cadastros/types'

export async function getSuppliersPaginated(params: PaginationParams): Promise<PaginatedResult<any>> {
  const { page, pageSize, search, status, city, sortBy, sortOrder } = params

  const where: any = {}

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (city) {
    where.city = city
  }

  if (search) {
    const digits = onlyDigits(search)
    where.OR = [
      { companyName: { contains: search } },
      { tradeName: { contains: search } },
      ...(digits ? [{ document: { contains: digits } }] : []),
    ]
  }

  let orderBy: any = { companyName: 'asc' }
  if (sortBy) {
    switch (sortBy) {
      case 'companyName':
        orderBy = { companyName: sortOrder || 'asc' }
        break
      case 'tradeName':
        orderBy = { tradeName: sortOrder || 'asc' }
        break
      case 'document':
        orderBy = { document: sortOrder || 'asc' }
        break
      case 'cityState':
        orderBy = [{ city: sortOrder || 'asc' }, { state: sortOrder || 'asc' }]
        break
      case 'status':
        orderBy = { status: sortOrder || 'asc' }
        break
    }
  }

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getSupplierCities(): Promise<string[]> {
  const results = await prisma.supplier.findMany({
    select: { city: true },
    where: { city: { not: null } },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  })
  return results.map((r) => r.city).filter(Boolean) as string[]
}

export async function getSupplierCounts(): Promise<EntityCounts> {
  const [total, active] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.count({ where: { status: 'ACTIVE' } }),
  ])
  return { total, active, inactive: total - active }
}

export async function createSupplier(data: SupplierInput) {
  const parsed = supplierSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { document, ...rest } = parsed.data
  const documentType = detectDocumentType(document)!

  // Verificar duplicidade de documento
  const existing = await prisma.supplier.findUnique({
    where: { document },
  })
  if (existing) {
    throw new Error(`Já existe um fornecedor com este ${documentType}`)
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...rest,
      document,
      documentType,
      tradeName: rest.tradeName || null,
      stateRegistration: rest.stateRegistration || null,
      zipCode: rest.zipCode || null,
      street: rest.street || null,
      number: rest.number || null,
      complement: rest.complement || null,
      neighborhood: rest.neighborhood || null,
      city: rest.city || null,
      state: rest.state || null,
      phone: rest.phone || null,
      email: rest.email || null,
      contactName: rest.contactName || null,
      notes: rest.notes || null,
    },
  })

  revalidatePath('/cadastros/fornecedores')
  return supplier
}

export async function updateSupplier(id: string, data: SupplierInput) {
  const parsed = supplierSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message)
  }

  const { document, ...rest } = parsed.data
  const documentType = detectDocumentType(document)!

  // Verificar duplicidade de documento (excluindo o próprio)
  const existing = await prisma.supplier.findUnique({
    where: { document },
  })
  if (existing && existing.id !== id) {
    throw new Error(`Já existe outro fornecedor com este ${documentType}`)
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...rest,
      document,
      documentType,
      tradeName: rest.tradeName || null,
      stateRegistration: rest.stateRegistration || null,
      zipCode: rest.zipCode || null,
      street: rest.street || null,
      number: rest.number || null,
      complement: rest.complement || null,
      neighborhood: rest.neighborhood || null,
      city: rest.city || null,
      state: rest.state || null,
      phone: rest.phone || null,
      email: rest.email || null,
      contactName: rest.contactName || null,
      notes: rest.notes || null,
    },
  })

  revalidatePath('/cadastros/fornecedores')
  return supplier
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({ where: { id } })
  revalidatePath('/cadastros/fornecedores')
}

export async function toggleSupplierStatus(id: string) {
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } })
  const newStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  await prisma.supplier.update({
    where: { id },
    data: { status: newStatus },
  })

  revalidatePath('/cadastros/fornecedores')
}
