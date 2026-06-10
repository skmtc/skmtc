import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasObject } from '@/oas/object/Object.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

/**
 * Builds an `OasObject` representing the arguments tuple of a GraphQL
 * operation.
 *
 * Each argument becomes a property; required arguments without default
 * values go on the parent's `required` list (OAS convention). An
 * argument with both `required: true` and a non-undefined `defaultValue`
 * is *not* listed as required, because the caller can omit it and the
 * server fills in the default — surfacing it as required would be
 * misleading at the consumer side.
 *
 * Returns `undefined` when the operation takes no arguments. Callers can
 * use that to skip emitting an args type entirely.
 *
 * Lives in core (not in gen-graphql-operation) because it is generic
 * enough to be reused by any GraphQL operation generator and has no
 * generator-specific output assumptions.
 */
export const synthesizeArgsObject = (operation: GqlOperation): OasObject | undefined => {
  if (operation.arguments.length === 0) {
    return undefined
  }

  const properties: Record<string, OasSchema | OasRef<'schema'>> = {}
  const required: string[] = []

  for (const arg of operation.arguments) {
    properties[arg.name] = arg.schema
    if (arg.required && arg.defaultValue === undefined) {
      required.push(arg.name)
    }
  }

  return new OasObject({
    title: `${operation.fieldName} arguments`,
    properties,
    required: required.length > 0 ? required : undefined
  })
}
