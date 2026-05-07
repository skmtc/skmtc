/**
 * @fileoverview Enrichment System for SKMTC Core
 * 
 * This module provides comprehensive enrichment types and schemas for enhancing
 * OpenAPI operations with UI generation metadata. Enrichments allow generators
 * to create forms, tables, inputs, and other UI components with rich metadata
 * about how data should be presented and interacted with.
 * 
 * The enrichment system supports a hierarchical structure:
 * Generator → Path → Method → Operation → Component Type (form/table/input)
 * 
 * ## Key Features
 * 
 * - **Form Enrichments**: Field definitions with inputs, labels, and validation
 * - **Table Enrichments**: Column definitions with formatters and headers
 * - **Input Enrichments**: Standalone input components with formatting
 * - **Hierarchical Organization**: Nested structure for easy lookup and management
 * - **Type Safety**: Comprehensive Valibot validation for all enrichment data
 * 
 * @example Basic form enrichment
 * ```typescript
 * import type { FormItem } from '@skmtc/core/Enrichments';
 * 
 * const userForm: FormItem = {
 *   title: 'User Registration',
 *   description: 'Create a new user account',
 *   fields: [
 *     {
 *       id: 'name',
 *       accessorPath: ['name'],
 *       input: { moduleName: 'TextInput', exportName: 'default' },
 *       label: 'Full Name',
 *       placeholder: 'Enter your full name'
 *     }
 *   ],
 *   submitLabel: 'Create Account'
 * };
 * ```
 * 
 * @example Table enrichment with formatters
 * ```typescript
 * import type { TableItem } from '@skmtc/core/Enrichments';
 * 
 * const userTable: TableItem = {
 *   title: 'User Directory',
 *   columns: [
 *     {
 *       id: 'email',
 *       accessorPath: ['email'],
 *       formatter: { moduleName: 'EmailFormatter', exportName: 'default' },
 *       label: 'Email Address'
 *     }
 *   ]
 * };
 * ```
 * 
 * @module Enrichments
 */

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
  accessorPath: v.optional(v.array(v.string())),
  input: v.optional(moduleExport),
  label: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  // GraphQL Query / OAS operation reference backing this field. When set
  // and a producer generator (e.g. gen-reapit-searchable-dropdown) claims
  // the operation, the form generator dispatches the producer's component
  // via `context.insertOperation`. See the operation-reference protocol
  // in the SKMTC generator authoring guide.
  references: v.optional(v.string()),
  // Discriminator picking which producer generator handles a referenced
  // field. Form generators use this to dispatch to the right Insertable
  // class — e.g. `'searchable'` → `gen-reapit-searchable-dropdown`,
  // `'multiselect'` → `gen-reapit-multi-select`. Free-form string so
  // ecosystems can add new variants without core changes; conventional
  // values: `'searchable' | 'multiselect'`. Default behaviour when unset
  // is generator-specific.
  referenceKind: v.optional(v.string())
})

/**
 * Configuration for a single form field.
 *
 * Per-field override carried by the canonical `form.fields[]` enrichment.
 * `id` is required (it identifies which form argument/property the
 * override applies to); every other field is optional so callers only
 * carry the data they want to set. `references` opts the field into the
 * operation-reference dispatch protocol.
 */
export type FormFieldItem = {
  id: string
  accessorPath?: string[]
  input?: ModuleExport
  label?: string
  placeholder?: string
  references?: string
  referenceKind?: string
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
 * Valibot schema for OAS HTTP-method-level enrichments.
 *
 * Maps HTTP methods (`get`, `post`, ...) to their operation enrichment
 * configurations. OAS-only — keyed by HTTP method.
 */
export const oasMethodEnrichments: v.GenericSchema<OasMethodEnrichments> = v.record(
  v.string(),
  operationEnrichments
)

/**
 * HTTP method → operation enrichments map (OAS-only).
 */
export type OasMethodEnrichments = Record<string, OperationEnrichments>

/**
 * Valibot schema for OAS path-level enrichments.
 *
 * Maps API paths (e.g. `/users/{id}`) to their per-method enrichment
 * configurations. OAS-only — keyed by HTTP path template.
 */
export const oasPathEnrichments: v.GenericSchema<OasPathEnrichments> = v.record(
  v.string(),
  oasMethodEnrichments
)

/**
 * API path → method enrichments map (OAS-only).
 */
export type OasPathEnrichments = Record<string, OasMethodEnrichments>

/**
 * Valibot schema for GraphQL field-level enrichments.
 *
 * Maps root field names (e.g. `getUser`, `createPost`) to their operation
 * enrichment configurations. GraphQL-only — keyed by root field name.
 */
export const gqlFieldEnrichments: v.GenericSchema<GqlFieldEnrichments> = v.record(
  v.string(),
  operationEnrichments
)

/**
 * Root field name → operation enrichments map (GraphQL-only).
 */
export type GqlFieldEnrichments = Record<string, OperationEnrichments>

/**
 * Valibot schema for GraphQL root-kind-level enrichments.
 *
 * Maps root operation kinds (`query` / `mutation` / `subscription`) to their
 * per-field enrichment configurations. GraphQL-only.
 */
export const gqlRootKindEnrichments: v.GenericSchema<GqlRootKindEnrichments> = v.record(
  v.string(),
  gqlFieldEnrichments
)

/**
 * Root kind → field enrichments map (GraphQL-only).
 */
export type GqlRootKindEnrichments = Record<string, GqlFieldEnrichments>

/**
 * Valibot schema for generator-level enrichments.
 *
 * Top-level enrichment structure: maps generator IDs to either an OAS
 * path-keyed hierarchy or a GraphQL root-kind-keyed hierarchy. Both
 * variants share the {@link operationEnrichments} leaf shape (`{table,
 * form, input}`); they differ only in the two intermediate keys
 * (`path|method` vs `rootKind|fieldName`). The runtime variants are
 * structurally identical, so this is typed as the union.
 */
export const generatorEnrichments: v.GenericSchema<GeneratorEnrichments> = v.record(
  v.string(),
  v.union([oasPathEnrichments, gqlRootKindEnrichments])
)

/**
 * Generator ID → enrichment hierarchy (OAS path/method or GraphQL
 * rootKind/fieldName). The two halves are structurally identical at
 * runtime — the named alias documents which protocol's lookup keys are
 * expected at each level.
 */
export type GeneratorEnrichments = Record<string, OasPathEnrichments | GqlRootKindEnrichments>
