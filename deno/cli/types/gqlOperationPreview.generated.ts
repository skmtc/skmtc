import { z } from 'zod'

export const gqlOperationPreview = z.object({
  type: z.literal('gqlOperation'),
  generatorId: z.string(),
  rootKind: z.enum(['query', 'mutation', 'subscription']),
  fieldName: z.string(),
})
