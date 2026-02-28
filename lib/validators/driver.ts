import { z } from 'zod'

export const driverSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  document: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  license: z.string().optional().or(z.literal('')),
})

export type DriverInput = z.infer<typeof driverSchema>
