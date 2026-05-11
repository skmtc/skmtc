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
import { unwrapType } from '@/gql/_helpers/unwrapType.ts'
import { toScalarType } from '@/gql/scalar/toScalarType.ts'
import { toEnumType } from '@/gql/enum/toEnumType.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Args for {@link toFieldSchema}.
 *
 * Mirrors the OAS parser convention `{ value, context, stackTrail }` —
 * the stack trail represents the field's schema-level address (e.g.
 * `User.posts`, `Query.getUser.return`). Issues recorded inside use
 * `stackTrail.toString()` for the location string; ref consumers
 * register via `context.registerRef(stackTrail, typeName)` so the
 * cross-type invalidation pipeline can prune fields whose target type
 * fails to parse.
 */
export type ToFieldSchemaArgs = {
  type: GraphQLType
  context: ParseContextType
  stackTrail: StackTrail
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
  stackTrail
}: ToFieldSchemaArgs): OasSchema | OasRef<'schema'> => {
  const { named, isList, outerNullable, itemNullable, nestedList } = unwrapType(type)

  if (nestedList) {
    // Nested lists (`[[T]]`) aren't representable as a single OasArray of
    // items; fall back to OasUnknown to avoid producing a wrong type.
    // Generators that care can later be extended; this is a v1 limitation.
    context.log({
      level: 'warning',
      location: stackTrail.toString(),
      message: `Nested list type collapsed to 'unknown' — v1 limitation`,
      type: 'NESTED_LIST_LOSSY'
    })
    return new OasUnknown({ nullable: outerNullable })
  }

  // Resolve the inner schema (the part inside the optional list wrapper).
  const innerSchema = ((): OasSchema | OasRef<'schema'> => {
    const innerNullable = isList ? itemNullable : outerNullable

    if (isScalarType(named)) {
      return toScalarType({ scalar: named, nullable: innerNullable, context, stackTrail })
    }
    if (isEnumType(named)) {
      return toEnumType({ enumType: named, nullable: innerNullable, context, stackTrail })
    }
    if (
      isObjectType(named) ||
      isInputObjectType(named) ||
      isInterfaceType(named) ||
      isUnionType(named)
    ) {
      // Composite types live in the registry; the field gets a ref.
      // Register the consumer location so `removeErroredItems` can
      // prune this field if `named.name`'s type fails to parse.
      context.registerRef(stackTrail.clone(), named.name)

      // OasRef has no nullable flag, so when the field is nullable we wrap
      // the ref in a single-member OasUnion that carries the flag instead.
      const ref = context.registry.createRef(
        named.name as RefName,
        context.parsedDocument
      )
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
      location: stackTrail.toString(),
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
