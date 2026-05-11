import type { GraphQLType } from 'graphql'
import {
  isObjectType,
  isInputObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isScalarType
} from 'graphql'
import { OasArray } from '@/oas/array/Array.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'
import { unwrapType } from '@/parsers/graphql/unwrapType.ts'
import { toScalarType } from '@/parsers/graphql/toScalarType.ts'
import { toEnumType } from '@/parsers/graphql/toEnumType.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import type { ParseContext } from '@/context/ParseContext.ts'

/**
 * Args for {@link toFieldSchema}.
 *
 * `context` carries both the GraphQL schema and the in-progress
 * registry — helpers no longer thread these as separate arguments
 * (mirrors OAS's `(context, stackTrail)` shape).
 */
export type ToFieldSchemaArgs = {
  type: GraphQLType
  context: ParseContext
  /**
   * Schema-level address of this field (e.g. `User.posts`,
   * `Query.getUser.return`). Threaded into any issue this call
   * records. Falls back to `'<unknown>'` when omitted.
   */
  location?: string
}

/**
 * Converts a GraphQL field type into an `OasSchema | OasRef<'schema'>`
 * suitable for use inside an `OasObject.properties` slot or as the
 * `returnType` / argument type of a {@link GqlOperation}.
 *
 * Named composite types (objects, inputs, interfaces, unions) become
 * refs into the registry so cross-type references resolve through the
 * registry's internal mirror. Scalars and enums are emitted inline
 * because they don't need to be referenced from anywhere else (their
 * type info is fully self-contained).
 *
 * The function also encodes the GraphQL list-nullability matrix:
 * `[T]`, `[T!]`, `[T]!`, `[T!]!` each produce different combinations of
 * `OasArray.nullable` and the inner schema's nullability.
 */
export const toFieldSchema = ({
  type,
  context,
  location = '<unknown>'
}: ToFieldSchemaArgs): OasSchema | OasRef<'schema'> => {
  const { named, isList, outerNullable, itemNullable, nestedList } = unwrapType(type)

  if (nestedList) {
    // Nested lists (`[[T]]`) aren't representable as a single OasArray of
    // items; fall back to OasUnknown to avoid producing a wrong type.
    // Generators that care can later be extended; this is a v1 limitation.
    context.log({
      level: 'warning',
      location,
      message: `Nested list type collapsed to 'unknown' — v1 limitation`,
      type: 'NESTED_LIST_LOSSY'
    })
    return new OasUnknown({ nullable: outerNullable })
  }

  // Resolve the inner schema (the part inside the optional list wrapper).
  const innerSchema = ((): OasSchema | OasRef<'schema'> => {
    const innerNullable = isList ? itemNullable : outerNullable

    if (isScalarType(named)) {
      return toScalarType(named, innerNullable)
    }
    if (isEnumType(named)) {
      return toEnumType(named, innerNullable)
    }
    if (
      isObjectType(named) ||
      isInputObjectType(named) ||
      isInterfaceType(named) ||
      isUnionType(named)
    ) {
      // Composite types live in the registry; the field gets a ref.
      // OasRef has no nullable flag, so when the field is nullable we wrap
      // the ref in a single-member OasUnion that carries the flag instead.
      const ref = context.registry.createRef(named.name as RefName)
      return innerNullable
        ? new OasUnion({ members: [ref], nullable: true })
        : ref
    }
    // Unknown kind — defensive fallback. Shouldn't fire under
    // graphql-js's type system, but if it does we want a loud signal.
    // `named` is `never` here per exhaustiveness so we coerce to read
    // `.name` for the diagnostic without leaking the cast elsewhere.
    const unrecognised = named as { name?: string }
    context.log({
      level: 'error',
      location,
      message: `Unknown GraphQL type kind for '${unrecognised.name ?? '<anon>'}' — fell back to 'unknown'`,
      type: 'UNKNOWN_TYPE_KIND'
    })
    return new OasUnknown({ nullable: innerNullable })
  })()

  if (!isList) {
    return innerSchema
  }

  return new OasArray({
    items: innerSchema,
    nullable: outerNullable
  })
}
