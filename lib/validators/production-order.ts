import { z } from 'zod'

export const generateProductionOrdersSchema = z.object({
  orderId: z.string().min(1, 'Pedido é obrigatório'),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1, 'Item do pedido é obrigatório'),
        productId: z.string().min(1, 'Produto é obrigatório'),
        quantityPieces: z.number().int().positive('Quantidade deve ser maior que zero'),
        toProducePieces: z.number().int().min(0, 'Quantidade a produzir não pode ser negativa'),
        notes: z.string().optional(),
      })
    )
    .min(1, 'Pelo menos um item é obrigatório'),
})

export type GenerateProductionOrdersInput = z.infer<typeof generateProductionOrdersSchema>
