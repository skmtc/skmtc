import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
import { toExternalDocs } from '../externalDocs/toExternalDocs.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isRef, toRefName } from '@/helpers/refFns.ts'
export type ToUnionArgs = {
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  parentType: 'anyOf' | 'oneOf'
  stackTrail: StackTrail
  context: ParseContextType
  /** The component name this union IS, when it is one — a member naming it is dropped. */
  selfName?: string
}

export const toUnion = ({
  value,
  members,
  parentType,
  stackTrail,
  context,
  selfName
}: ToUnionArgs): OasUnion => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context,
    stackTrail
  })

  const {
    discriminator,
    title,
    description,
    externalDocs,
    example: unparsedExample,
    default: unparsedDefaultValue,
    ...skipped
  } = valueWithoutNullable

  const example = parseExample({
    value: unparsedExample,
    context,
    parent: value,
    nullable,
    check: isPresent,
    toMessage: item => `Removed invalid example. Expected a non-null value, got: ${item}`,
    stackTrail
  })

  const defaultValue = parseDefault({
    value: unparsedDefaultValue,
    context,
    parent: value,
    nullable,
    check: isPresent,
    toMessage: item => `Removed invalid default. Expected a non-null value, got: ${item}`,
    stackTrail
  })

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    stackTrail,
    parentType: `schema:${parentType}`
  })

  const discriminatorParsed = stackTrail.trace('discriminator', st =>
    toDiscriminatorV3({ discriminator, stackTrail: st, context })
  )

  const membersParsed = members.reduce<(OasSchema | OasRef<'schema'>)[]>((acc, item, index) => {
    if (item === undefined || item === null) {
      return acc
    }

    // A union member that refers to the union itself says nothing (`M = M |
    // …`); it appears when a recursive `allOf` copies its base's union in.
    if (selfName !== undefined && isRef(item) && toRefName(item.$ref) === selfName) {
      return acc
    }

    // A member that fails to parse is dropped and the union survives — the
    // behaviour the merge layer's cross product always had, now with the
    // failure recorded rather than swallowed.
    // Recorded at warning: an error-level issue under a component marks the
    // component itself as failed and prunes everything that refers to it,
    // which one bad member of a surviving union does not justify.
    try {
      return [
        ...acc,
        stackTrail.trace(`${index}`, st => toSchemaV3({ schema: item, stackTrail: st, context }))
      ]
    } catch (error) {
      stackTrail.trace(`${index}`, st => {
        context.logIssueNoKey({
          level: 'warning',
          type: 'INVALID_SCHEMA',
          parent: item,
          stackTrail: st,
          message: `Union member dropped: ${error instanceof Error ? error.message : String(error)}`
        })
      })

      return acc
    }
  }, [])

  if (membersParsed.length === 0) {
    throw new Error(`"${parentType}" has no members left after parsing`)
  }

  return context.withStackTrail(
    stackTrail,
    () =>
      new OasUnion(
        {
          title,
          description,
          externalDocs: stackTrail.trace('externalDocs', st =>
            toExternalDocs({ externalDocs, stackTrail: st, context })
          ),
          nullable,
          default: defaultValue,
          discriminator: discriminatorParsed,
          members: membersParsed,
          example,
          extensionFields
        },
        context
      )
  )
}

// A union (anyOf/oneOf) value may match any of its members, so the most we
// can validate without resolving members is that a present default/example
// is not a bare `null` on a non-nullable schema.
const isPresent = (value: unknown): value is NonNullable<unknown> => {
  return value !== null && value !== undefined
}
