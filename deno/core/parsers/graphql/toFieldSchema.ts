import type { GraphQLType, GraphQLSchema } from 'graphql'
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
import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { RefName } from '@/types/RefName.ts'
import { unwrapType } from '@/parsers/graphql/unwrapType.ts'
import { toScalarType } from '@/parsers/graphql/toScalarType.ts'
import { toEnumType } from '@/parsers/graphql/toEnumType.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'

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
 *
 * @param type      The GraphQL field type (possibly wrapped in NonNull / List).
 * @param schema    The full GraphQL schema (used to look up named-type definitions).
 * @param registry  The GQL registry (used to construct refs for composite types).
 * @returns A schema/ref ready to assign to a property or argument slot.
 */
export const toFieldSchema = (
  type: GraphQLType,
  schema: GraphQLSchema,
  registry: GqlRegistry
): OasSchema | OasRef<'schema'> => {
  const { named, isList, outerNullable, itemNullable, nestedList } = unwrapType(type)

  if (nestedList) {
    // Nested lists (`[[T]]`) aren't representable as a single OasArray of
    // items; fall back to OasUnknown to avoid producing a wrong type.
    // Generators that care can later be extended; this is a v1 limitation.
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
      return registry.createRef(named.name as RefName)
    }
    // Unknown kind — defensive fallback.
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
