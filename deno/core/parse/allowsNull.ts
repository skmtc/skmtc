import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefParts, toRefPointer } from '@/helpers/refFns.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'

type AllowsNullArgs = {
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  /** The schema a ref names, or `undefined` when it names nothing. */
  peek: (ref: OpenAPIV3.ReferenceObject) => OpenAPIV3.SchemaObject | undefined
  /** The ref targets that are being read. */
  visited?: Set<string>
}

/**
 * Whether a schema allows `null`, itself or through its refs and its `allOf`,
 * `oneOf` and `anyOf` members. One member of an `allOf` is enough, as in a
 * merge. A member that leads back to a schema that is being read adds nothing.
 */
export const allowsNull = ({ schema, peek, visited = new Set() }: AllowsNullArgs): boolean => {
  // 3.1 and 3.2 write `null` in `type`, which the 3.0 types do not have.
  const type: unknown = Reflect.get(schema, 'type')

  if (Reflect.get(schema, 'nullable') === true || type === 'null' || (Array.isArray(type) && type.includes('null'))) {
    return true
  }

  if (isRef(schema)) {
    const pointer = toRefPointer(toRefParts({ $ref: schema.$ref }))
    const target = visited.has(pointer) ? undefined : peek(schema)

    visited.add(pointer)

    return target !== undefined && allowsNull({ schema: target, peek, visited })
  }

  return [schema.allOf, schema.oneOf, schema.anyOf]
    .flatMap(members => (Array.isArray(members) ? members : []))
    .filter(isPlainObject)
    .some(member => allowsNull({ schema: member, peek, visited }))
}
