import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
/**
 * Resolves a `$ref` to its schema, carrying the set of pointers already being
 * expanded above it.
 *
 * The path rides on the resolver rather than being a separate parameter so that
 * the eight modules which merely forward `getRef` — the per-type constraint
 * mergers, `merge-properties`, `generic-merge` — propagate it without knowing it
 * exists. Only the three places that actually dereference need to consult it.
 */
export type GetRefFn = ((ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject) & {
  /** `$ref` pointers being expanded on the current path. Absent at the root. */
  readonly expanding?: ReadonlySet<string>
}

export type OneOfObject = {
  oneOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject

export type AnyOfObject = {
  anyOf?: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
} & OpenAPIV3.SchemaObject

export type SchemaObject = OpenAPIV3.SchemaObject
export type ReferenceObject = OpenAPIV3.ReferenceObject
export type SchemaOrReference = SchemaObject | ReferenceObject

export type ArraySchemaObject = OpenAPIV3.ArraySchemaObject

export const IntegerSchema = v.pipe(v.number(), v.integer('The number must be an integer.'))
