import { moduleExport, type ModuleExport } from './ModuleExport.ts'
import * as v from 'valibot'

/**
 * Valibot schema for form field items.
 * 
 * Validates individual form field configurations including input components,
 * labels, placeholders, and data access paths.
 */
export const formFieldItem: v.GenericSchema<FormFieldItem> = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  input: moduleExport,
  label: v.string(),
  placeholder: v.optional(v.string())
})

/**
 * Configuration for a single form field.
 * 
 * Defines how a form field should be rendered, including its input component,
 * label text, data binding path, and optional placeholder text.
 */
export type FormFieldItem = {
  id: string
  accessorPath: string[]
  input: ModuleExport
  label: string
  placeholder?: string
}

/**
 * Valibot schema for form configurations.
 * 
 * Validates complete form definitions including title, description,
 * field configurations, and submit button labels.
 */
export const formItem: v.GenericSchema<FormItem> = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  fields: v.optional(v.array(formFieldItem)),
  submitLabel: v.optional(v.string())
})

/**
 * Configuration for a complete form.
 * 
 * Represents a form with optional title, description, field definitions,
 * and customizable submit button label.
 */
export type FormItem = {
  title?: string
  description?: string
  fields?: FormFieldItem[]
  submitLabel?: string
}

/**
 * Valibot schema for table column items.
 * 
 * Validates table column configurations including formatter components,
 * labels, and data access paths.
 */
export const tableColumnItem: v.GenericSchema<TableColumnItem> = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  formatter: moduleExport,
  label: v.string()
})

/**
 * Configuration for a single table column.
 * 
 * Defines how a table column should be rendered, including its formatter
 * component, display label, and data binding path.
 */
export type TableColumnItem = {
  id: string
  accessorPath: string[]
  formatter: ModuleExport
  label: string
}

/**
 * Valibot schema for table configurations.
 * 
 * Validates complete table definitions including title, description,
 * and column configurations.
 */
export const tableItem: v.GenericSchema<TableItem> = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  columns: v.optional(v.array(tableColumnItem))
})

/**
 * Configuration for a complete table.
 * 
 * Represents a table with optional title, description, and column definitions.
 */
export type TableItem = {
  title?: string
  description?: string
  columns?: TableColumnItem[]
}

/**
 * Valibot schema for input items.
 * 
 * Validates input component configurations including formatter components
 * and data access paths.
 */
export const inputItem: v.GenericSchema<InputItem> = v.object({
  id: v.string(),
  accessorPath: v.array(v.string()),
  formatter: moduleExport
})

/**
 * Configuration for a single input component.
 * 
 * Defines how an input should be rendered, including its formatter
 * component and data binding path.
 */
export type InputItem = {
  id: string
  accessorPath: string[]
  formatter: ModuleExport
}

/**
 * Valibot schema for operation-level enrichments.
 * 
 * Validates enrichment configurations that can be applied to OpenAPI operations,
 * including table, form, and input component definitions.
 */
export const operationEnrichments: v.GenericSchema<OperationEnrichments> = v.object({
  table: v.optional(tableItem),
  form: v.optional(formItem),
  input: v.optional(inputItem)
})

/**
 * Enrichment configurations for a single OpenAPI operation.
 * 
 * Contains optional table, form, and input configurations that can enhance
 * how an operation is presented and interacted with in generated UIs.
 */
export type OperationEnrichments = {
  table?: TableItem
  form?: FormItem
  input?: InputItem
}

/**
 * Valibot schema for HTTP method-level enrichments.
 * 
 * Maps HTTP methods (GET, POST, etc.) to their operation enrichment configurations.
 */
export const methodEnrichments: v.GenericSchema<MethodEnrichments> = v.record(v.string(), operationEnrichments)

/**
 * HTTP method to operation enrichments mapping.
 * 
 * Associates HTTP methods with their corresponding operation enrichment configurations.
 */
export type MethodEnrichments = Record<string, OperationEnrichments>

/**
 * Valibot schema for API path-level enrichments.
 * 
 * Maps API paths to their method enrichment configurations.
 */
export const pathEnrichments: v.GenericSchema<PathEnrichments> = v.record(v.string(), methodEnrichments)

/**
 * API path to method enrichments mapping.
 * 
 * Associates API paths with their corresponding method enrichment configurations.
 */
export type PathEnrichments = Record<string, MethodEnrichments>

/**
 * Valibot schema for generator-level enrichments.
 * 
 * Maps generator IDs to their path enrichment configurations,
 * creating a complete hierarchy of enrichment data.
 */
export const generatorEnrichments: v.GenericSchema<GeneratorEnrichments> = v.record(v.string(), pathEnrichments)

/**
 * Generator ID to path enrichments mapping.
 * 
 * Top-level enrichment structure that organizes enrichment data by generator,
 * then by path, then by HTTP method, providing complete enrichment hierarchies.
 */
export type GeneratorEnrichments = Record<string, PathEnrichments>
