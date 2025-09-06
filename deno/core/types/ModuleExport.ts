import * as v from 'valibot'

export const moduleExport: v.GenericSchema<ModuleExport> = v.object({
  exportName: v.string(),
  exportPath: v.string()
})

export type ModuleExport = {
  exportName: string
  exportPath: string
}
