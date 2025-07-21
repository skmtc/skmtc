import { moduleExport, type ModuleExport } from './ModuleExport.ts'
import * as v from 'valibot'

export const formFieldItem = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  input: moduleExport,
  label: v.string(),
  placeholder: v.optional(v.string())
})

export type FormFieldItem = {
  id: string
  accessorPath: string[]
  input: ModuleExport
  label: string
  placeholder?: string
}

export const formItem = v.object({
  title: v.string(),
  fields: v.array(formFieldItem)
})

export type FormItem = {
  title: string
  fields: FormFieldItem[]
}

export const tableColumnItem = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  formatter: moduleExport,
  label: v.string()
})

export type TableColumnItem = {
  id: string
  accessorPath: string[]
  formatter: ModuleExport
  label: string
}

export const inputOptionConfigItem = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  formatter: moduleExport
})

export type InputOptionConfigItem = {
  id: string
  accessorPath: string[]
  formatter: ModuleExport
}

export const operationEnrichments = v.object({
  columns: v.array(tableColumnItem),
  form: formItem,
  optionLabel: inputOptionConfigItem
})

export type OperationEnrichments = {
  columns: TableColumnItem[]
  form: FormItem
  optionLabel: InputOptionConfigItem
}

export const methodEnrichments = v.record(v.string(), operationEnrichments)

export type MethodEnrichments = Record<string, OperationEnrichments>

export const pathEnrichments = v.record(v.string(), methodEnrichments)

export type PathEnrichments = Record<string, MethodEnrichments>

export const generatorEnrichments = v.record(v.string(), pathEnrichments)

export type GeneratorEnrichments = Record<string, PathEnrichments>
