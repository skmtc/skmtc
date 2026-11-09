import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'
export type GetRefFn = (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject

/**
 * Maps a schema the merge reads (a member, a nested property or item schema,
 * a `$ref` target) onto the shape the merge understands. The caller supplies
 * it, so the merge holds no dialect rules of its own. Must be idempotent.
 */
export type NormalizeFn = (schema: OpenAPIV3.SchemaObject) => OpenAPIV3.SchemaObject

/**
 * The `system` settings as the merge reads them (`client.json#settings.system`),
 * and the keywords a later `allOf` member replaced under `latestWins`, so
 * the parser can name them in one warning for the schema.
 */
export type MergeSystem = {
  /** `strict`: a contradiction between members fails the merge. `latestWins`: the later member's keyword wins. */
  allOf: 'strict' | 'latestWins'
  /** `unknown`: a member with `not` merges, its `not` carried as written. Left out: `strict`, which refuses it. */
  not?: 'strict' | 'unknown'
  replaced: Set<string>
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

/**
 * Two schemas to merge, how to follow a reference and normalize a member, and
 * the `system` settings: what each merge step takes.
 */
export type MergeArgs<Schema = SchemaOrReference> = {
  first: Schema
  second: Schema
  getRef: GetRefFn
  normalize: NormalizeFn
  system: MergeSystem
}

/** {@link MergeArgs}, and the valibot schema `default`, `enum` and `example` values must pass. */
export type GenericMergeArgs<T> = MergeArgs<SchemaObject> & {
  typeCheck?: v.GenericSchema<T>
}

export type ArraySchemaObject = OpenAPIV3.ArraySchemaObject

export const IntegerSchema = v.pipe(v.number(), v.integer('The number must be an integer.'))
