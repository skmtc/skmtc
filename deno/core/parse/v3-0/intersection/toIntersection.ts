import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { OasIntersection } from '@/oas/intersection/Intersection.ts'
import { isRef } from '@/helpers/refFns.ts'
import { hasShapeKeyword } from '@/parse/anyOfSystem.ts'
import { withKeywordType } from '@/parse/keptIntersection.ts'
import { toSchemaV3 } from '@/parse/v3-0/schema/toSchemasV3.ts'
import { toUnknown } from '@/parse/v3-0/unknown/toUnknown.ts'
import { toSpecificationExtensionsV3 } from '@/parse/v3-0/specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '@/parse/v3-0/_helpers/parseNullable.ts'
import { parseExample } from '@/parse/v3-0/_helpers/parseExample.ts'
import { parseDefault } from '@/parse/v3-0/_helpers/parseDefault.ts'
import { toExternalDocs } from '@/parse/v3-0/externalDocs/toExternalDocs.ts'

export type ToIntersectionArgs = {
  /** The intersection's own keywords, without `allOf`. */
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  stackTrail: StackTrail
  context: ParseContextType
}

export const toIntersection = ({ value, members, stackTrail, context }: ToIntersectionArgs): OasIntersection => {
  const { nullable, value: valueWithoutNullable } = parseNullable({ value, context, stackTrail })

  const {
    title,
    description,
    externalDocs,
    readOnly,
    writeOnly,
    deprecated,
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
    parentType: 'schema:allOf'
  })

  // A member with no shape of its own (`{ description }`) is any value: the
  // parser must not guess a type from its `example`.
  const membersParsed = members.map(withKeywordType).map((member, index) =>
    stackTrail.trace(`${index}`, st =>
      isRef(member) || hasShapeKeyword(member) || 'anyOf' in member || 'not' in member
        ? toSchemaV3({ schema: member, stackTrail: st, context })
        : toUnknown({ value: member, stackTrail: st, context })
    )
  )

  return context.withStackTrail(
    stackTrail,
    () =>
      new OasIntersection(
        {
          title,
          description,
          externalDocs: stackTrail.trace('externalDocs', st =>
            toExternalDocs({ externalDocs, stackTrail: st, context })
          ),
          nullable,
          readOnly,
          writeOnly,
          deprecated,
          default: defaultValue,
          members: membersParsed,
          example,
          extensionFields
        },
        context
      )
  )
}

// A value matches every member, so without resolving them the most we can
// check is that a present default/example is not `null` on a non-nullable schema.
const isPresent = (value: unknown): value is NonNullable<unknown> => value !== null && value !== undefined
