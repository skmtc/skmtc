import { z } from 'zod'
import { method } from '@/types/method.generated.ts'

export const operationPreview = z.object({
  type: z.literal('operation'),
  generatorId: z.string(),
  operationPath: z.string(),
  operationMethod: method,
})
