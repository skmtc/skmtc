import { ModuleExport, moduleExport } from '@/types/moduleExport.generated.ts'
import { z } from 'zod'

export type TableColumnItem = {
  id: string
  accessorPath: Array<string>
  formatter: ModuleExport
  label: string
}

export const tableColumnItem = z.object({
  id: z.string(),
  accessorPath: z.array(z.string()),
  formatter: moduleExport,
  label: z.string(),
})
