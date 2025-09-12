import { ModuleExport, moduleExport } from '@/types/moduleExport.generated.ts'
import { z } from 'zod'

export type InputItem = {
  id: string
  accessorPath: Array<string>
  formatter: ModuleExport
}

export const inputItem = z.object({
  id: z.string(),
  accessorPath: z.array(z.string()),
  formatter: moduleExport,
})
