import {
  buildSchema,
  type GraphQLSchema,
  isObjectType,
  isInputObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isScalarType,
  isIntrospectionType
} from 'graphql'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { GqlRootTypes } from '@/gql/rootType/GqlRootTypes.ts'
import { toObjectType } from '@/parsers/graphql/toObjectType.ts'
import { toInputType } from '@/parsers/graphql/toInputType.ts'
import { toEnumType } from '@/parsers/graphql/toEnumType.ts'
import { toUnionType } from '@/parsers/graphql/toUnionType.ts'
import { toInterfaceUnion } from '@/parsers/graphql/toInterfaceUnion.ts'
import { toScalarType } from '@/parsers/graphql/toScalarType.ts'
import { toRootField } from '@/parsers/graphql/toRootField.ts'
import type { RefName } from '@/types/RefName.ts'

/**
 * Options accepted by {@link toGqlDocument}.
 */
export type ToGqlDocumentOptions = {
  /**
   * Suffix appended to the union form of an interface to disambiguate it
   * from the base interface object type registered under the same logical
   * name. Defaults to `'Union'` (so `Node` interface produces `Node`
   * object + `NodeUnion` union).
   */
  interfaceUnionSuffix?: string
  /**
   * Whether to emit the per-interface union of implementers. Default
   * `true`. The base interface object is always emitted.
   */
  emitInterfaceUnions?: boolean
}

/**
 * Parses a GraphQL SDL string (or pre-built {@link GraphQLSchema}) into a
 * {@link GqlDocument}.
 *
 * Walks all named types in the schema (skipping introspection types),
 * registers them in the document's {@link GqlRegistry}, and surfaces the
 * root-level fields of Query / Mutation / Subscription as
 * {@link GqlOperation} entries.
 *
 * The resulting document is a drop-in second variant for the
 * `SkmtcDocument` discriminated union — model generators read it via the
 * registry, GraphQL-protocol operation generators read its `operations`.
 */
export const toGqlDocument = (
  source: string | GraphQLSchema,
  options: ToGqlDocumentOptions = {}
): GqlDocument => {
  const { interfaceUnionSuffix = 'Union', emitInterfaceUnions = true } = options

  const schema: GraphQLSchema = typeof source === 'string' ? buildSchema(source) : source

  const registry = new GqlRegistry({ schemas: {} })

  // Pass 1: walk all named types and register them.
  const typeMap = schema.getTypeMap()
  for (const [name, type] of Object.entries(typeMap)) {
    if (isIntrospectionType(type)) continue
    // Skip the root operation types if they're encountered here; we treat
    // their fields as operations, not as object schema entries that need
    // their own registry slot. Generators that want a "Query" type can
    // look at the rootTypes pointers.
    if (
      type === schema.getQueryType() ||
      type === schema.getMutationType() ||
      type === schema.getSubscriptionType()
    ) {
      continue
    }

    if (isObjectType(type)) {
      registry.add(name as RefName, toObjectType(type, schema, registry))
    } else if (isInputObjectType(type)) {
      registry.add(name as RefName, toInputType(type, schema, registry))
    } else if (isInterfaceType(type)) {
      // Base interface as an object (so generators can emit a TS interface).
      registry.add(name as RefName, toObjectType(type, schema, registry))
      if (emitInterfaceUnions) {
        const unionName = `${name}${interfaceUnionSuffix}` as RefName
        registry.add(unionName, toInterfaceUnion(type, schema, registry))
      }
    } else if (isUnionType(type)) {
      registry.add(name as RefName, toUnionType(type, registry))
    } else if (isEnumType(type)) {
      registry.add(name as RefName, toEnumType(type))
    } else if (isScalarType(type)) {
      // Built-in scalars (Int, String, …) are inlined at usage sites and
      // don't need registry entries; only register custom scalars so
      // downstream generators can iterate them if needed.
      const isBuiltin =
        type.name === 'Int' ||
        type.name === 'Float' ||
        type.name === 'String' ||
        type.name === 'Boolean' ||
        type.name === 'ID'
      if (!isBuiltin) {
        registry.add(name as RefName, toScalarType(type, false))
      }
    }
  }

  // Pass 2: build operations from each root type's fields.
  const operations = []
  const rootTypes: GqlRootTypes = {}

  const queryType = schema.getQueryType()
  if (queryType) {
    rootTypes.query = queryType.name as RefName
    for (const field of Object.values(queryType.getFields())) {
      operations.push(toRootField('query', field, schema, registry))
    }
  }

  const mutationType = schema.getMutationType()
  if (mutationType) {
    rootTypes.mutation = mutationType.name as RefName
    for (const field of Object.values(mutationType.getFields())) {
      operations.push(toRootField('mutation', field, schema, registry))
    }
  }

  const subscriptionType = schema.getSubscriptionType()
  if (subscriptionType) {
    rootTypes.subscription = subscriptionType.name as RefName
    for (const field of Object.values(subscriptionType.getFields())) {
      operations.push(toRootField('subscription', field, schema, registry))
    }
  }

  return new GqlDocument({
    registry,
    operations,
    rootTypes
  })
}
