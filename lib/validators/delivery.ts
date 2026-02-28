import { z } from 'zod'

export const deliveryItemSchema = z.object({
  orderItemId: z.string().min(1, 'Item do pedido é obrigatório'),
  productId: z.string().min(1, 'Produto é obrigatório'),
  quantityPieces: z.number().int().positive('Quantidade deve ser maior que zero'),
})

export const createDeliverySchema = z.object({
  orderId: z.string().min(1, 'Pedido é obrigatório'),
  vehicleId: z.string().optional().or(z.literal('')),
  driverId: z.string().optional().or(z.literal('')),
  loadingDate: z.string().min(1, 'Data de carregamento é obrigatória'),
  deliveryAddress: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(deliveryItemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

export type DeliveryItemInput = z.infer<typeof deliveryItemSchema>
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>
