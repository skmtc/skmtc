import { z } from 'zod'

export type SkipPaths = {
  get?: Array<string> | undefined
  post?: Array<string> | undefined
  put?: Array<string> | undefined
  delete?: Array<string> | undefined
  patch?: Array<string> | undefined
}

export const skipPaths = z.object({
  get: z.array(z.string()).optional(),
  post: z.array(z.string()).optional(),
  put: z.array(z.string()).optional(),
  delete: z.array(z.string()).optional(),
  patch: z.array(z.string()).optional(),
})
