import { z } from 'zod'

export const generator = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  dependencies: z.array(z.string()),
  sourceUrl: z.string(),
  registryUrl: z.string(),
  readme: z.string(),
  scope: z.string(),
  packageName: z.string(),
  createdAt: z.string(),
})

export type Generator = {
  id: string
  name: string
  description?: string | undefined
  dependencies: Array<string>
  sourceUrl: string
  registryUrl: string
  readme: string
  scope: string
  packageName: string
  createdAt: string
}
