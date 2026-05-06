import type { GraphQLField, GraphQLArgument } from 'graphql'
import { isNonNullType } from 'graphql'
import { GqlOperation, type GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import { GqlArgument } from '@/gql/argument/GqlArgument.ts'
import { toFieldSchema } from '@/parsers/graphql/toFieldSchema.ts'
import { recordAppliedDirectives } from '@/parsers/graphql/recordAppliedDirectives.ts'
import type { GqlParseContext } from '@/context/GqlParseContext.ts'

export type ToRootFieldArgs = {
  rootKind: GqlRootKind
  field: GraphQLField<unknown, unknown>
  /**
   * Type name of the root operation type that owns this field
   * (`'Query'`, `'Mutation'`, `'Subscription'` — or whatever the
   * schema renamed them to). Used for issue location attribution.
   */
  rootTypeName: string
  context: GqlParseContext
}

/**
 * Converts a single root-level GraphQL field into a {@link GqlOperation}.
 *
 * Used for each field on the Query / Mutation / Subscription root types.
 * Field arguments become {@link GqlArgument} instances; the return type
 * runs through {@link toFieldSchema} like any other field type.
 */
export const toRootField = ({
  rootKind,
  field,
  rootTypeName,
  context
}: ToRootFieldArgs): GqlOperation => {
  const operationLocation = `${rootTypeName}.${field.name}`

  // Field-level directives on the root field itself (`me: User @auth`).
  recordAppliedDirectives(field.astNode, operationLocation, context)

  const args: GqlArgument[] = field.args.map((arg: GraphQLArgument) => {
    return new GqlArgument({
      name: arg.name,
      schema: toFieldSchema({
        type: arg.type,
        context,
        location: `${operationLocation}.args.${arg.name}`
      }),
      required: isNonNullType(arg.type),
      // graphql-js's `GraphQLType.toString()` produces SDL syntax
      // (`'ID!'`, `'[String!]'`). Stash it for downstream generators
      // that need to reconstruct an SDL fragment.
      gqlType: arg.type.toString(),
      defaultValue: arg.defaultValue,
      description: arg.description ?? undefined,
      deprecated: arg.deprecationReason !== null && arg.deprecationReason !== undefined,
      deprecationReason: arg.deprecationReason ?? undefined
    })
  })

  const returnType = toFieldSchema({
    type: field.type,
    context,
    location: `${operationLocation}.return`
  })

  return new GqlOperation({
    rootKind,
    fieldName: field.name,
    arguments: args,
    returnType,
    returnTypeString: field.type.toString(),
    description: field.description ?? undefined,
    deprecated:
      field.deprecationReason !== null && field.deprecationReason !== undefined,
    deprecationReason: field.deprecationReason ?? undefined
  })
}
