import { z } from 'zod'

export const manifestEntry = z.object({
  lines: z.number().int(),
  characters: z.number().int(),
  destinationPath: z.string(),
})
