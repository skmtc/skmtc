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
import { GqlParseContext } from '@/gql/parse/GqlParseContext.ts'

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
 * Built-in GraphQL directives that are part of every schema and not
 * worth reporting as "skipped" — they always exist whether the user
 * authored them or not.
 */
const BUILTIN_DIRECTIVES = new Set([
  'skip',
  'include',
  'deprecated',
  'specifiedBy',
  'oneOf'
])

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
 *
 * @param source   SDL string or pre-built `GraphQLSchema`.
 * @param options  Optional parser knobs (see {@link ToGqlDocumentOptions}).
 * @param context  Optional {@link GqlParseContext} for issue tracking.
 *                 Pass one in if you want to surface lossy or skipped
 *                 mappings to the user. Issues are otherwise discarded.
 *                 The function populates `context.schema` and
 *                 `context.registry` before invoking any helper.
 */
export const toGqlDocument = (
  source: string | GraphQLSchema,
  options: ToGqlDocumentOptions = {},
  context: GqlParseContext = new GqlParseContext()
): GqlDocument => {
  const { interfaceUnionSuffix = 'Union', emitInterfaceUnions = true } = options

  const schema: GraphQLSchema = typeof source === 'string' ? buildSchema(source) : source
  const registry = new GqlRegistry({ schemas: {} })

  // Populate the parse-run state on the context. Helpers thread only
  // `context` from here on and reach into these fields when they need
  // schema lookups or registry operations.
  context.schema = schema
  context.registry = registry

  // Schema-level: warn about user-defined directives we don't model.
  for (const directive of schema.getDirectives()) {
    if (BUILTIN_DIRECTIVES.has(directive.name)) continue
    context.log({
      level: 'warning',
      location: `@${directive.name}`,
      message: `Custom directive '@${directive.name}' is not represented in generated output`,
      type: 'DROPPED_DIRECTIVE'
    })
  }

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
      registry.add(name as RefName, toObjectType({ objectType: type, context }))
    } else if (isInputObjectType(type)) {
      registry.add(name as RefName, toInputType({ inputType: type, context }))
    } else if (isInterfaceType(type)) {
      // Base interface as an object (so generators can emit a TS interface).
      registry.add(name as RefName, toObjectType({ objectType: type, context }))
      if (emitInterfaceUnions) {
        const unionName = `${name}${interfaceUnionSuffix}` as RefName
        registry.add(unionName, toInterfaceUnion({ interfaceType: type, context }))
      }
    } else if (isUnionType(type)) {
      registry.add(name as RefName, toUnionType({ unionType: type, context }))
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
      operations.push(
        toRootField({
          rootKind: 'query',
          field,
          rootTypeName: queryType.name,
          context
        })
      )
    }
  }

  const mutationType = schema.getMutationType()
  if (mutationType) {
    rootTypes.mutation = mutationType.name as RefName
    for (const field of Object.values(mutationType.getFields())) {
      operations.push(
        toRootField({
          rootKind: 'mutation',
          field,
          rootTypeName: mutationType.name,
          context
        })
      )
    }
  }

  const subscriptionType = schema.getSubscriptionType()
  if (subscriptionType) {
    rootTypes.subscription = subscriptionType.name as RefName
    for (const field of Object.values(subscriptionType.getFields())) {
      operations.push(
        toRootField({
          rootKind: 'subscription',
          field,
          rootTypeName: subscriptionType.name,
          context
        })
      )
    }
  }

  return new GqlDocument({
    registry,
    operations,
    rootTypes
  })
}
