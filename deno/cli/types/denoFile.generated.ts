import { z } from 'zod'

export const denoFile = z.object({
  type: z.literal('file'),
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']),
})

export type DenoFile = {
  type: 'file'
  content: string
  encoding: 'utf-8' | 'base64'
}
