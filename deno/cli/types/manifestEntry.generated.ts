import { z } from 'zod'

export const manifestEntry = z.object({
  lines: z.number().int(),
  characters: z.number().int(),
  generatorKeys: z.array(z.string()),
  destinationPath: z.string(),
})
