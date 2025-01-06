import { z } from 'zod'

export type Preview = {
  importName: string
  importPath: string
  group: string
  route?: string
}

export const preview = z.object({
  importName: z.string(),
  importPath: z.string(),
  group: z.string(),
  route: z.string().optional()
})
