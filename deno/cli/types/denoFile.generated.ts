import { z } from 'zod'

export const denoFile = z.object({
  kind: z.literal('file'),
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']),
})

export type DenoFile = {
  kind: 'file'
  content: string
  encoding: 'utf-8' | 'base64'
}
