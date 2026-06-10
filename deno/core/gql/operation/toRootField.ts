import type { GraphQLField, GraphQLArgument } from 'graphql'
import { isNonNullType } from 'graphql'
import { GqlOperation, type GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import { GqlArgument } from '@/gql/argument/GqlArgument.ts'
import { toFieldSchema } from '@/gql/field/toFieldSchema.ts'
import { recordAppliedDirectives } from '@/gql/_helpers/recordAppliedDirectives.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToRootFieldArgs = {
  rootKind: GqlRootKind
  field: GraphQLField<unknown, unknown>
  context: ParseContextType
  /**
   * Stack trail for the root field. Typical shape is `[<RootType>,
   * <fieldName>]` (e.g. `[Query, getUser]`); the function descends
   * into `args:<argName>` and `return` traces for child parses, so
   * `removeErroredItems` can prune individual args or the entire
   * operation depending on which target type errored.
   */
  stackTrail: StackTrail
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
  context,
  stackTrail
}: ToRootFieldArgs): GqlOperation => {
  // Field-level directives on the root field itself (`me: User @auth`).
  recordAppliedDirectives({ astNode: field.astNode, stackTrail, context })

  const args: GqlArgument[] = field.args.map((arg: GraphQLArgument) =>
    stackTrail.trace(`args:${arg.name}`, argStack => {
      const schema = toFieldSchema({
        type: arg.type,
        context,
        stackTrail: argStack
      })

      return context.withStackTrail(argStack, () =>
        new GqlArgument(
          {
            name: arg.name,
            schema,
            required: isNonNullType(arg.type),
            // graphql-js's `GraphQLType.toString()` produces SDL syntax
            // (`'ID!'`, `'[String!]'`). Stash it for downstream generators
            // that need to reconstruct an SDL fragment.
            gqlType: arg.type.toString(),
            defaultValue: arg.defaultValue,
            description: arg.description ?? undefined,
            deprecated: arg.deprecationReason !== null && arg.deprecationReason !== undefined,
            deprecationReason: arg.deprecationReason ?? undefined
          },
          context
        )
      )
    })
  )

  const returnType = stackTrail.trace('return', returnStack =>
    toFieldSchema({
      type: field.type,
      context,
      stackTrail: returnStack
    })
  )

  return context.withStackTrail(stackTrail, () =>
    new GqlOperation(
      {
        rootKind,
        fieldName: field.name,
        arguments: args,
        returnType,
        returnTypeString: field.type.toString(),
        description: field.description ?? undefined,
        deprecated:
          field.deprecationReason !== null && field.deprecationReason !== undefined,
        deprecationReason: field.deprecationReason ?? undefined
      },
      context
    )
  )
}
