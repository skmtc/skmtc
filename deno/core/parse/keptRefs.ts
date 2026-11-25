import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toGetRef } from '@/helpers/refFns.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { toCyclicRefs } from '@/parse/toCyclicRefs.ts'
import { haveNoCommonType, isWithin, toDeclaredTypes } from '@/parse/toDeclaredTypes.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject
type SchemaOrReference = SchemaObject | ReferenceObject

/** The refs that `system.intersections` keeps out of a merge. */
export type KeptRefs = {
  /** Whether a merge keeps this `$ref` object as a ref. */
  has: (ref: ReferenceObject) => boolean
  /** Returns `to`, a `$ref` object made from `from`, kept when `from` is. */
  copy: (from: ReferenceObject, to: ReferenceObject) => ReferenceObject
  /** Whether merging this schema gives an intersection: it is a kept ref or has one in its `allOf`, also through refs that are not kept. */
  holds: (schema: SchemaOrReference) => boolean
  /** Whether a pair that holds a kept ref allows no value: the two types, read through refs, have none in common. */
  contradict: (first: SchemaOrReference, second: SchemaOrReference) => boolean
  /** Whether a ref's target, read through refs, allows no type but those of `schema`. */
  declaresTypeOf: (ref: ReferenceObject, schema: SchemaObject) => boolean
}

type ToKeptRefsArgs = {
  documentObject: OpenAPIV3.Document
  /** `client.json` `system.intersections`. */
  setting: 'merge' | 'cycles' | 'all' | undefined
}

/** The refs a merge of this document keeps, or `undefined` under `merge`. */
export const toKeptRefs = ({ documentObject, setting = 'cycles' }: ToKeptRefsArgs): KeptRefs | undefined => {
  if (setting === 'merge') {
    return undefined
  }

  const cyclicRefs = setting === 'cycles' ? toCyclicRefs(documentObject) : new WeakSet<object>()
  const has = (ref: ReferenceObject): boolean => setting === 'all' || cyclicRefs.has(ref)
  const getRef = toGetRef(documentObject)

  // A ref that names nothing is reported where the merge follows it.
  const peek = (ref: ReferenceObject): SchemaObject | undefined => {
    try {
      return getRef(ref)
    } catch (error) {
      if (DanglingRefError.is(error)) {
        return undefined
      }

      throw error
    }
  }

  const held = new WeakMap<object, boolean>()

  const isHolder = (schema: SchemaOrReference): boolean => {
    if (isRef(schema)) {
      const target = has(schema) ? undefined : peek(schema)

      return has(schema) || (target !== undefined && holds(target))
    }

    return Array.isArray(schema.allOf) && schema.allOf.some(holds)
  }

  const holds = (schema: SchemaOrReference): boolean => {
    // A document in the wild may hold a string where a member belongs.
    if (!isPlainObject(schema)) {
      return false
    }

    const known = held.get(schema)

    if (known !== undefined) {
      return known
    }

    const result = isHolder(schema)
    held.set(schema, result)

    return result
  }

  return {
    has,
    holds,
    copy: (from, to) => {
      if (cyclicRefs.has(from)) {
        cyclicRefs.add(to)
      }

      return to
    },
    contradict: (first, second) =>
      (holds(first) || holds(second)) &&
      haveNoCommonType(toDeclaredTypes({ schema: first, peek }), toDeclaredTypes({ schema: second, peek })),
    declaresTypeOf: (ref, schema) =>
      isWithin(toDeclaredTypes({ schema: ref, peek }), toDeclaredTypes({ schema, peek }))
  }
}
