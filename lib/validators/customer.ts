import { z } from 'zod'
import { onlyDigits, isValidCPF, isValidCNPJ, detectDocumentType } from '@/lib/document'

export const customerSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Razão social deve ter no mínimo 2 caracteres')
    .max(200, 'Razão social deve ter no máximo 200 caracteres'),
  tradeName: z.string().max(200).optional().or(z.literal('')),
  document: z
    .string()
    .min(1, 'Documento é obrigatório')
    .transform(onlyDigits)
    .refine((val) => val.length === 11 || val.length === 14, {
      message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos',
    })
    .refine(
      (val) => {
        const type = detectDocumentType(val)
        if (type === 'CPF') return isValidCPF(val)
        if (type === 'CNPJ') return isValidCNPJ(val)
        return false
      },
      { message: 'CPF ou CNPJ inválido' }
    ),
  stateRegistration: z.string().max(20).optional().or(z.literal('')),
  zipCode: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? onlyDigits(val) : val)),
  street: z.string().max(200).optional().or(z.literal('')),
  number: z.string().max(20).optional().or(z.literal('')),
  complement: z.string().max(100).optional().or(z.literal('')),
  neighborhood: z.string().max(100).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z
    .string()
    .max(2)
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? val.toUpperCase() : val)),
  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? onlyDigits(val) : val)),
  email: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Email inválido',
    }),
  contactName: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type CustomerInput = z.input<typeof customerSchema>
export type CustomerParsed = z.output<typeof customerSchema>
