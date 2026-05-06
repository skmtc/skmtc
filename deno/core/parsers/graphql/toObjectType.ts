import type { GraphQLObjectType, GraphQLInterfaceType } from 'graphql'
import { isNonNullType } from 'graphql'
import { OasObject } from '@/oas/object/Object.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toFieldSchema } from '@/parsers/graphql/toFieldSchema.ts'
import type { GqlParseContext } from '@/gql/parse/GqlParseContext.ts'

export type ToObjectTypeArgs = {
  objectType: GraphQLObjectType | GraphQLInterfaceType
  context: GqlParseContext
}

/**
 * Converts a GraphQL object or interface type into an `OasObject`.
 *
 * Interfaces and object types share the same field-set shape, so a single
 * converter handles both. Object property types come from
 * {@link toFieldSchema}; the GraphQL non-null indicator on each field
 * lifts into the parent's `required` list (OAS convention).
 *
 * Records skipped-feature warnings via `context` for non-root fields
 * that carry arguments — those args aren't represented in the OAS
 * model so the user would otherwise have no signal that they exist.
 */
export const toObjectType = ({ objectType, context }: ToObjectTypeArgs): OasObject => {
  const fields = objectType.getFields()
  const properties: Record<string, OasSchema | OasRef<'schema'>> = {}
  const required: string[] = []

  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldLocation = `${objectType.name}.${fieldName}`

    properties[fieldName] = toFieldSchema({
      type: field.type,
      context,
      location: fieldLocation
    })

    // GraphQL non-null at the outer position means the parent guarantees
    // this field will be present — encode as `required` in the parent.
    if (isNonNullType(field.type)) {
      required.push(fieldName)
    }

    // Non-root object/interface fields can carry their own arguments
    // (e.g. `posts(limit: Int): [Post!]!`). Our schema-driven model
    // doesn't represent those — log them as skipped so the user knows
    // they exist on the GraphQL side.
    if (field.args.length > 0) {
      const skipped: Record<string, unknown> = {}
      for (const arg of field.args) {
        skipped[arg.name] = arg.defaultValue
      }
      context.logSkippedFields({
        skipped,
        location: fieldLocation,
        parentType: 'objectField',
        type: 'SKIPPED_FIELD_ARGUMENTS'
      })
    }
  }

  return new OasObject({
    title: objectType.name,
    description: objectType.description ?? undefined,
    properties,
    required: required.length > 0 ? required : undefined
  })
}
