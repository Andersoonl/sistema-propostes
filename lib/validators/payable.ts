import { z } from 'zod'

export const createPayableSchema = z.object({
  supplierId: z.string().optional().or(z.literal('')),
  category: z.enum(['RAW_MATERIAL', 'ENERGY', 'MAINTENANCE', 'PAYROLL', 'TAXES', 'OTHER'], {
    message: 'Categoria é obrigatória',
  }),
  description: z.string().min(1, 'Descrição é obrigatória'),
  invoiceNumber: z.string().optional().or(z.literal('')),
  issueDate: z.string().min(1, 'Data de emissão é obrigatória'),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória'),
  totalAmount: z.number().positive('Valor total deve ser maior que zero'),
  notes: z.string().optional().or(z.literal('')),
})

export const updatePayableSchema = createPayableSchema

export const payablePaymentSchema = z.object({
  amount: z.number().positive('Valor deve ser maior que zero'),
  paymentDate: z.string().min(1, 'Data do pagamento é obrigatória'),
  paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória'),
  reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type CreatePayableInput = z.infer<typeof createPayableSchema>
export type UpdatePayableInput = z.infer<typeof updatePayableSchema>
export type PayablePaymentInput = z.infer<typeof payablePaymentSchema>
