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
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  fields: v.array(formFieldItem),
  submitLabel: v.optional(v.string())
})

export type FormItem = {
  title?: string
  description?: string
  fields: FormFieldItem[]
  submitLabel?: string
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

export const tableItem = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  columns: v.array(tableColumnItem)
})

export type TableItem = {
  title?: string
  description?: string
  columns: TableColumnItem[]
}

export const inputItem = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  formatter: moduleExport
})

export type InputItem = {
  id: string
  accessorPath: string[]
  formatter: ModuleExport
}

export const operationEnrichments = v.object({
  table: v.optional(tableItem),
  form: v.optional(formItem),
  input: v.optional(inputItem)
})

export type OperationEnrichments = {
  table?: TableItem
  form?: FormItem
  input?: InputItem
}

export const methodEnrichments = v.record(v.string(), operationEnrichments)

export type MethodEnrichments = Record<string, OperationEnrichments>

export const pathEnrichments = v.record(v.string(), methodEnrichments)

export type PathEnrichments = Record<string, MethodEnrichments>

export const generatorEnrichments = v.record(v.string(), pathEnrichments)

export type GeneratorEnrichments = Record<string, PathEnrichments>
