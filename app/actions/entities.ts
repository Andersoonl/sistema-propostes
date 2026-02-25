'use server'

import { prisma } from '@/lib/prisma'
import { onlyDigits } from '@/lib/document'

export async function checkDocumentExists(
  document: string,
  excludeId?: string
): Promise<{ type: 'cliente' | 'fornecedor'; name: string } | null> {
  const digits = onlyDigits(document)
  if (digits.length !== 11 && digits.length !== 14) return null

  const customer = await prisma.customer.findUnique({
    where: { document: digits },
    select: { id: true, companyName: true },
  })
  if (customer && customer.id !== excludeId) {
    return { type: 'cliente', name: customer.companyName }
  }

  const supplier = await prisma.supplier.findUnique({
    where: { document: digits },
    select: { id: true, companyName: true },
  })
  if (supplier && supplier.id !== excludeId) {
    return { type: 'fornecedor', name: supplier.companyName }
  }

  return null
}
