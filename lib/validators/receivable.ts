import { z } from 'zod'

export const createReceivableSchema = z.object({
  orderId: z.string().optional().or(z.literal('')),
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  description: z.string().optional().or(z.literal('')),
  invoiceNumber: z.string().optional().or(z.literal('')),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória'),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória'),
  totalAmount: z.number().positive('Valor total deve ser maior que zero'),
  notes: z.string().optional().or(z.literal('')),
})

export const updateReceivableSchema = createReceivableSchema

export const receivablePaymentSchema = z.object({
  amount: z.number().positive('Valor deve ser maior que zero'),
  paymentDate: z.string().min(1, 'Data do pagamento é obrigatória'),
  paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória'),
  reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type CreateReceivableInput = z.infer<typeof createReceivableSchema>
export type UpdateReceivableInput = z.infer<typeof updateReceivableSchema>
export type ReceivablePaymentInput = z.infer<typeof receivablePaymentSchema>
