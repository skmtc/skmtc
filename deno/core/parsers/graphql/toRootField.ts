import type { GraphQLField, GraphQLArgument, GraphQLSchema } from 'graphql'
import { isNonNullType } from 'graphql'
import { GqlOperation, type GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import { GqlArgument } from '@/gql/argument/GqlArgument.ts'
import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { toFieldSchema } from '@/parsers/graphql/toFieldSchema.ts'

/**
 * Converts a single root-level GraphQL field into a {@link GqlOperation}.
 *
 * Used for each field on the Query / Mutation / Subscription root types.
 * Field arguments become {@link GqlArgument} instances; the return type
 * runs through {@link toFieldSchema} like any other field type.
 */
export const toRootField = (
  rootKind: GqlRootKind,
  field: GraphQLField<unknown, unknown>,
  schema: GraphQLSchema,
  registry: GqlRegistry
): GqlOperation => {
  const args: GqlArgument[] = field.args.map((arg: GraphQLArgument) => {
    return new GqlArgument({
      name: arg.name,
      schema: toFieldSchema(arg.type, schema, registry),
      required: isNonNullType(arg.type),
      defaultValue: arg.defaultValue,
      description: arg.description ?? undefined,
      deprecated: arg.deprecationReason !== null && arg.deprecationReason !== undefined,
      deprecationReason: arg.deprecationReason ?? undefined
    })
  })

  const returnType = toFieldSchema(field.type, schema, registry)

  return new GqlOperation({
    rootKind,
    fieldName: field.name,
    arguments: args,
    returnType,
    description: field.description ?? undefined,
    deprecated:
      field.deprecationReason !== null && field.deprecationReason !== undefined,
    deprecationReason: field.deprecationReason ?? undefined
  })
}
