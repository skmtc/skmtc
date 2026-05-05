import type { GraphQLObjectType, GraphQLSchema, GraphQLInterfaceType } from 'graphql'
import { isNonNullType } from 'graphql'
import { OasObject } from '@/oas/object/Object.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { toFieldSchema } from '@/parsers/graphql/toFieldSchema.ts'

/**
 * Converts a GraphQL object or interface type into an `OasObject`.
 *
 * Interfaces and object types share the same field-set shape, so a single
 * converter handles both. Object property types come from
 * {@link toFieldSchema}; the GraphQL non-null indicator on each field
 * lifts into the parent's `required` list (OAS convention).
 *
 * The resulting object is added to the registry under the type's name.
 */
export const toObjectType = (
  objectType: GraphQLObjectType | GraphQLInterfaceType,
  schema: GraphQLSchema,
  registry: GqlRegistry
): OasObject => {
  const fields = objectType.getFields()
  const properties: Record<string, OasSchema | OasRef<'schema'>> = {}
  const required: string[] = []

  for (const [fieldName, field] of Object.entries(fields)) {
    properties[fieldName] = toFieldSchema(field.type, schema, registry)

    // GraphQL non-null at the outer position means the parent guarantees
    // this field will be present — encode as `required` in the parent.
    if (isNonNullType(field.type)) {
      required.push(fieldName)
    }
  }

  return new OasObject({
    title: objectType.name,
    description: objectType.description ?? undefined,
    properties,
    required: required.length > 0 ? required : undefined
  })
}
