import { ModuleExport, moduleExport } from '@/types/moduleExport.generated.ts'
import { z } from 'zod'

export type FormFieldItem = {
  id: string
  accessorPath: Array<string>
  input: ModuleExport
  label: string
  placeholder?: string | undefined
}

export const formFieldItem = z.object({
  id: z.string(),
  accessorPath: z.array(z.string()),
  input: moduleExport,
  label: z.string(),
  placeholder: z.string().optional(),
})
