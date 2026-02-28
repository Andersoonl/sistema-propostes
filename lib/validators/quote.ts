import { z } from 'zod'

export const quoteItemSchema = z.object({
  productId: z.string().min(1, 'Produto é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser maior que zero'),
  unit: z.enum(['PIECES', 'M2']),
  unitPrice: z.number().min(0, 'Preço unitário não pode ser negativo'),
  discount: z.number().min(0, 'Desconto não pode ser negativo').max(100, 'Desconto máximo é 100%').default(0),
})

export const createQuoteSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  validUntil: z.string().min(1, 'Data de validade é obrigatória'),
  projectName: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().optional().or(z.literal('')),
  paymentMethod: z.string().optional().or(z.literal('')),
  deliveryType: z.string().optional().or(z.literal('')),
  deliveryAddress: z.string().optional().or(z.literal('')),
  deliverySchedule: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(quoteItemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

export const updateQuoteSchema = createQuoteSchema.extend({
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
})

export type QuoteItemInput = z.infer<typeof quoteItemSchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
