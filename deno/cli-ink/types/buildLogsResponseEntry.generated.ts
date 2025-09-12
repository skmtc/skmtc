import { z } from 'zod'

export const buildLogsResponseEntry = z.object({
  level: z.enum(['error', 'warning', 'info', 'debug']),
  message: z.string(),
})
