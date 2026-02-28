import { z } from 'zod'

export const vehicleSchema = z.object({
  plate: z
    .string()
    .min(1, 'Placa é obrigatória')
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((v) => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v), 'Placa inválida (ABC1234 ou ABC1D23)'),
  description: z.string().optional().or(z.literal('')),
  capacity: z.string().optional().or(z.literal('')),
})

export type VehicleInput = z.infer<typeof vehicleSchema>
