import { z } from 'zod'

export type ModulePackage = {
  rootPath: string
  moduleName?: string | undefined
}

export const modulePackage = z.object({
  rootPath: z.string(),
  moduleName: z.string().optional(),
})
