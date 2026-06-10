import { z } from 'zod'
import { method } from '@/types/method.generated.ts'

export const oasOperationPreview = z.object({
  type: z.literal('oasOperation'),
  generatorId: z.string(),
  operationPath: z.string(),
  operationMethod: method,
})
