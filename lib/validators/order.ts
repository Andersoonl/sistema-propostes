import { z } from 'zod'

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Produto é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser maior que zero'),
  unit: z.enum(['PIECES', 'M2']),
  unitPrice: z.number().min(0, 'Preço unitário não pode ser negativo'),
  discount: z.number().min(0, 'Desconto não pode ser negativo').max(100, 'Desconto máximo é 100%').default(0),
})

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  deliveryDate: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(orderItemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

export type OrderItemInput = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
