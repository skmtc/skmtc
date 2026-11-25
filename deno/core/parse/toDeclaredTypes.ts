import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefParts, toRefPointer } from '@/helpers/refFns.ts'

type SchemaOrReference = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

/** The types a schema allows, or `any`. */
export type DeclaredTypes = string[] | 'any'

type ToDeclaredTypesArgs = {
  schema: SchemaOrReference
  /** The schema a ref names, or `undefined` when it names nothing. */
  peek: (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject | undefined
  /** The types of each ref target met so far: `any` for one that is being read. */
  known?: Map<string, DeclaredTypes>
}

/**
 * The types a schema declares, itself or through its refs and its `allOf`,
 * `oneOf` and `anyOf` members. A member that leads back to a schema that is
 * being read counts as any type, so the types are never too few.
 */
export const toDeclaredTypes = ({ schema, peek, known = new Map() }: ToDeclaredTypesArgs): DeclaredTypes => {
  if (isRef(schema)) {
    const pointer = toRefPointer(toRefParts({ $ref: schema.$ref }))
    const found = known.get(pointer)

    if (found !== undefined) {
      return found
    }

    known.set(pointer, 'any')
    const target = peek(schema)
    const types = target === undefined ? 'any' : toDeclaredTypes({ schema: target, peek, known })
    known.set(pointer, types)

    return types
  }

  const toMemberTypes = (members: unknown): DeclaredTypes[] =>
    (Array.isArray(members) ? members : [])
      .filter((member): member is SchemaOrReference => typeof member === 'object' && member !== null)
      .map(member => toDeclaredTypes({ schema: member, peek, known }))

  const constraints = [
    toOwnTypes(schema.type),
    ...toMemberTypes(schema.allOf),
    toUnionTypes(toMemberTypes(schema.oneOf)),
    toUnionTypes(toMemberTypes(schema.anyOf))
  ].filter(isTypeList)

  const [first, ...rest] = constraints

  return first === undefined ? 'any' : rest.reduce(toCommonTypes, first)
}

/** Whether two schemas' types have none in common. */
export const haveNoCommonType = (first: DeclaredTypes, second: DeclaredTypes): boolean =>
  isTypeList(first) && isTypeList(second) && toCommonTypes(first, second).length === 0

/** Whether the first types are known, and each is one of the second. */
export const isWithin = (first: DeclaredTypes, second: DeclaredTypes): boolean =>
  isTypeList(first) && isTypeList(second) && toCommonTypes(first, second).length === first.length

/** A `type` as a list without `null`, which 3.1 writes in one. Every integer is a number. */
const toOwnTypes = (type: unknown): DeclaredTypes => {
  const types = (Array.isArray(type) ? type : [type])
    .filter(item => typeof item === 'string' && item !== 'null')
    .flatMap(item => (item === 'number' ? ['number', 'integer'] : [item]))

  return types.length > 0 ? types : 'any'
}

const toUnionTypes = (members: DeclaredTypes[]): DeclaredTypes =>
  members.length > 0 && members.every(isTypeList) ? [...new Set(members.flat())] : 'any'

const isTypeList = (types: DeclaredTypes): types is string[] => Array.isArray(types)

const toCommonTypes = (first: string[], second: string[]): string[] => first.filter(type => second.includes(type))
