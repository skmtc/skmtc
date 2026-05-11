import type { GraphQLInputObjectType } from 'graphql'
import { isNonNullType } from 'graphql'
import { OasObject } from '@/oas/object/Object.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toFieldSchema } from '@/parsers/graphql/toFieldSchema.ts'
import { recordAppliedDirectives } from '@/parsers/graphql/recordAppliedDirectives.ts'
import type { ParseContext } from '@/context/ParseContext.ts'

export type ToInputTypeArgs = {
  inputType: GraphQLInputObjectType
  context: ParseContext
}

/**
 * Converts a GraphQL input object type into an `OasObject`.
 *
 * Input objects are structurally identical to objects from a parsing
 * perspective, but they live in a separate names namespace at the
 * GraphQL level (`UserInput` is distinct from `User`). The parser
 * registers them under their own name, and downstream generators are
 * free to emit them as separate TypeScript types.
 *
 * One semantic note: an input field marked `required` (non-null) without
 * a default value must be supplied by the caller; one with a default
 * value can be omitted. The `required` list here reflects the
 * non-null-ness alone — generators that want the "effectively optional
 * because of default" interpretation should consult `defaultValue` on
 * the field as well, which is preserved on the inner schema's
 * `default` slot when present.
 */
export const toInputType = ({ inputType, context }: ToInputTypeArgs): OasObject => {
  recordAppliedDirectives(inputType.astNode, inputType.name, context)

  const fields = inputType.getFields()
  const properties: Record<string, OasSchema | OasRef<'schema'>> = {}
  const required: string[] = []

  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldLocation = `${inputType.name}.${fieldName}`
    recordAppliedDirectives(field.astNode, fieldLocation, context)

    properties[fieldName] = toFieldSchema({
      type: field.type,
      context,
      location: fieldLocation
    })
    if (isNonNullType(field.type)) {
      required.push(fieldName)
    }
  }

  return new OasObject({
    title: inputType.name,
    description: inputType.description ?? undefined,
    properties,
    required: required.length > 0 ? required : undefined
  })
}
