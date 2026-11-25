import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefParts, toRefPointer } from '@/helpers/refFns.ts'
import { isUnknownAnyOf } from '@/parse/anyOfSystem.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { toOwnTypes } from '@/parse/toDeclaredTypes.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type SchemaOrReference = SchemaObject | OpenAPIV3.ReferenceObject

type DeclaresTypeArgs = {
  schema: SchemaOrReference
  /** The only types the schema may allow. */
  types: string[]
  /** The schema a ref names, or `undefined` when it names nothing. */
  peek: (ref: OpenAPIV3.ReferenceObject) => SchemaObject | undefined
  getRef: (ref: OpenAPIV3.ReferenceObject) => SchemaObject
  /** `client.json` `system.anyOf`. */
  anyOf: 'union' | 'unknown' | undefined
  /** The answer for each ref target met so far: `false` for one that is being read. */
  known?: Map<string, boolean>
}

/** The keywords that say what a value is. A `type` with none of them can be left out of a merge. */
const SHAPE_KEYWORDS = ['properties', 'additionalProperties', 'items', 'enum', 'const', 'format', 'pattern', 'required']

/**
 * Whether a schema, read through its refs, allows only `types`, and says so by
 * something that stays in the parsed schema. A bare `type` beside an `allOf`
 * or a union, or as a member of an `allOf`, does not count: the parser may
 * leave it out because of what is beside it. A schema that leads back to
 * itself does not count either. Where it is not sure, the answer is `false`.
 */
export const declaresType = ({ schema, types, peek, getRef, anyOf, known = new Map() }: DeclaresTypeArgs): boolean => {
  const declares = (member: unknown): boolean =>
    isPlainObject(member) && declaresType({ schema: member, types, peek, getRef, anyOf, known })

  if (isRef(schema)) {
    const pointer = toRefPointer(toRefParts({ $ref: schema.$ref }))
    const found = known.get(pointer)

    if (found !== undefined) {
      return found
    }

    known.set(pointer, false)

    const result = declares(peek(schema))
    known.set(pointer, result)

    return result
  }

  const hasShape = SHAPE_KEYWORDS.some(keyword => keyword in schema)
  const isComposed = [schema.allOf, schema.oneOf, schema.anyOf].some(Array.isArray)

  if (hasShape || !isComposed) {
    const own = toOwnTypes(schema.type)

    if (own !== 'any' && own.every(type => types.includes(type))) {
      return true
    }
  }

  const isBareType = (member: unknown): boolean =>
    isPlainObject(member) && 'type' in member && !SHAPE_KEYWORDS.some(keyword => keyword in member) &&
    ![member.allOf, member.oneOf, member.anyOf].some(Array.isArray)

  const allOf = Array.isArray(schema.allOf) ? schema.allOf : []

  if (allOf.some(member => (allOf.length === 1 || !isBareType(member)) && declares(member))) {
    return true
  }

  const isUnknown = Array.isArray(schema.anyOf) &&
    schema.anyOf.every(isPlainObject) &&
    isUnknownAnyOf({ members: schema.anyOf, setting: anyOf, getRef })

  return [schema.oneOf, isUnknown ? undefined : schema.anyOf].some(
    members => Array.isArray(members) && members.length > 0 && members.every(declares)
  )
}
