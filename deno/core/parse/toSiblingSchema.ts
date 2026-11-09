import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefName } from '@/helpers/refFns.ts'

/** How many references and one-member `allOf`s {@link toTargetType} follows. */
const MAX_LOOKUPS = 10

/**
 * The `type` of the schema a reference points to, read from the document as
 * written: through references and one-member `allOf`s, without parsing.
 * `undefined` when the target names no single type (a union, or no `type`).
 */
const toTargetType = (
  ref: OpenAPIV3.ReferenceObject,
  documentObject: OpenAPIV3.Document,
  lookups: number
): string | undefined => {
  const target = lookups < MAX_LOOKUPS ? documentObject.components?.schemas?.[toRefName(ref.$ref)] : undefined

  if (target === undefined) {
    return undefined
  }

  if (isRef(target)) {
    return toTargetType(target, documentObject, lookups + 1)
  }

  if (typeof target.type === 'string') {
    return target.type
  }

  const [only, ...others] = target.allOf ?? []

  return only !== undefined && others.length === 0 && isRef(only)
    ? toTargetType(only, documentObject, lookups + 1)
    : undefined
}

type ToSiblingSchemaArgs = {
  /** The keywords next to the one member, without `allOf` and the use-site flags. */
  keywords: OpenAPIV3.SchemaObject
  /** The one member: the reference. */
  ref: OpenAPIV3.ReferenceObject
  documentObject: OpenAPIV3.Document
}

/**
 * The keywords next to a reference in a one-member `allOf`, as a schema of
 * the target's type, so they parse as the keywords of that type
 * (`minLength` of a string, `properties` of an object). A `type` among the
 * keywords wins. An array gets empty `items`: the target's `items` stay.
 */
export const toSiblingSchema = ({ keywords, ref, documentObject }: ToSiblingSchemaArgs): OpenAPIV3.SchemaObject => {
  const type = toTargetType(ref, documentObject, 0)

  switch (type) {
    case 'array':
      return { type: 'array', items: {}, ...keywords }
    case 'object':
    case 'string':
    case 'number':
    case 'integer':
    case 'boolean':
      return { type, ...keywords }
    default:
      return keywords
  }
}
