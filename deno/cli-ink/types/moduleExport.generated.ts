import { z } from 'zod'

export type ModuleExport = { exportPath: string; exportName: string }

export const moduleExport = z.object({
  exportPath: z.string(),
  exportName: z.string(),
})
