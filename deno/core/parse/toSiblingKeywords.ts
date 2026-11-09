import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { SiblingKeywords } from '@/oas/schema/siblings.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'

type ToSiblingKeywordsArgs = {
  /** The keywords next to the one member, without `allOf` and the use-site flags. */
  keywords: OpenAPIV3.SchemaObject
  /** `keywords.properties`, parsed by the caller's version of the parser. */
  properties: Record<string, OasSchema | OasRef<'schema'>> | undefined
  /** `keywords.additionalProperties`, parsed the same way. */
  additionalProperties: boolean | OasSchema | OasRef<'schema'> | undefined
  /** The trail of the schema that holds the `allOf`. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * The keywords next to a reference in a one-member `allOf`, read without the
 * target's type (see `SiblingKeywords`): the reference stays lazy, so the
 * target may not be parsed yet. The ones the target cannot take are left out
 * at generate time (`OasRef.toSkippedSiblings`). An extension (`x-*`) is kept, as each
 * version's `toSpecificationExtensionsV3` keeps one; a keyword that no schema
 * has here is reported. `undefined` when no keyword is left. Shared by the
 * 3.0, 3.1 and 3.2 parsers.
 */
export const toSiblingKeywords = ({
  keywords,
  properties,
  additionalProperties,
  stackTrail,
  context
}: ToSiblingKeywordsArgs): SiblingKeywords | undefined => {
  const {
    properties: _properties,
    additionalProperties: _additionalProperties,
    type,
    title,
    description,
    deprecated,
    example,
    default: defaultValue,
    enum: enums,
    format,
    minLength,
    maxLength,
    pattern,
    multipleOf,
    minimum,
    maximum,
    exclusiveMinimum,
    exclusiveMaximum,
    minItems,
    maxItems,
    uniqueItems,
    required,
    minProperties,
    maxProperties,
    ...rest
  } = keywords

  const entries = Object.entries(rest)
  const extensionFields = Object.fromEntries(entries.filter(([key]) => key.startsWith('x-')))
  const skipped = Object.fromEntries(entries.filter(([key]) => !key.startsWith('x-')))

  if (!isEmpty(skipped)) {
    context.logSkippedFields({ skipped, parent: keywords, parentType: 'schema:siblings', stackTrail })
  }

  if (enums !== undefined && !Array.isArray(enums)) {
    context.logIssue({
      key: 'enum',
      level: 'warning',
      message: `Removed invalid enum. Expected an array, got: ${JSON.stringify(enums)}`,
      parent: keywords,
      stackTrail,
      type: 'INVALID_ENUM'
    })
  }

  const siblings: SiblingKeywords = {
    _type: type,
    title,
    description,
    deprecated,
    example,
    default: defaultValue,
    enums: Array.isArray(enums) ? enums : undefined,
    extensionFields: isEmpty(extensionFields) ? undefined : extensionFields,
    format,
    minLength,
    maxLength,
    pattern,
    multipleOf,
    minimum,
    maximum,
    exclusiveMinimum,
    exclusiveMaximum,
    minItems,
    maxItems,
    uniqueItems,
    properties,
    required,
    additionalProperties,
    minProperties,
    maxProperties
  }

  return Object.values(siblings).some(value => value !== undefined) ? siblings : undefined
}
