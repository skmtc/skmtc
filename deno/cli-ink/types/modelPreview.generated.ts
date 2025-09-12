import { z } from 'zod'

export const modelPreview = z.object({
  type: z.literal('model'),
  generatorId: z.string(),
  refName: z.string(),
})
