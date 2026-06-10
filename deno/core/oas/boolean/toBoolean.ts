import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { oasBooleanData } from './boolean-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToBooleanArgs = {
  value: OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Transforms an OpenAPI v3 boolean schema object into an internal OAS boolean representation.
 *
 * This function processes OpenAPI boolean schemas by extracting and parsing nullable values,
 * examples, enumerations, and default values. It handles the complete transformation from
 * raw OpenAPI JSON to the SKMTC internal boolean representation with proper validation.
 *
 * The transformation follows a pipeline approach:
 * 1. Parse nullable flag and extract base value
 * 2. Parse example values with nullable support
 * 3. Parse enumeration constraints (typically [true], [false], or [true, false])
 * 4. Parse default values
 * 5. Create final OasBoolean instance
 *
 * @param args - Transformation arguments
 * @param args.value - The OpenAPI v3 boolean schema object to transform
 * @param args.context - Parse context providing utilities and tracing
 * @returns Transformed OAS boolean object with parsed properties
 *
 * @example Basic boolean transformation
 * ```typescript
 * import { toBoolean } from '@skmtc/core';
 *
 * const openApiBoolean = {
 *   type: 'boolean',
 *   default: false
 * };
 *
 * const oasBoolean = toBoolean({
 *   value: openApiBoolean,
 *   context: parseContext
 * });
 *
 * console.log(oasBoolean.default); // false
 * ```
 *
 * @example Boolean with nullable and enum
 * ```typescript
 * const flagBoolean = {
 *   type: 'boolean',
 *   nullable: true,
 *   enum: [true, null],
 *   default: null,
 *   example: true,
 *   title: 'Feature Flag',
 *   description: 'Whether the feature is enabled'
 * };
 *
 * const oasBoolean = toBoolean({
 *   value: flagBoolean,
 *   context: parseContext
 * });
 *
 * console.log(oasBoolean.nullable); // true
 * console.log(oasBoolean.enums); // [true, null]
 * ```
 */
export const toBoolean = ({ value, stackTrail, context }: ToBooleanArgs): OasBoolean => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context,
    stackTrail
  })

  const { example: unparsedExample, ...valueWithoutExample } = valueWithoutNullable

  const example = parseExample({
    example: unparsedExample,
    context,
    parent: valueWithoutNullable,
    nullable,
    stackTrail
  })
  // const { enum: enums, value: valueWithoutEnums } = parseEnum({
  //   value: valueWithoutExample,
  //   nullable,
  //   valibotSchema: v.boolean(),
  //   context
  // })

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    parent: valueWithoutExample,
    stackTrail,
    context,
    check: isBoolean,
    toMessage: item => `Removed invalid enum. Expected "boolean", got: ${item}`
  })

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    defaultValue: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable,
    stackTrail
  })

  return toParsedBoolean({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault,
    stackTrail
  })
}

type ToParsedBooleanArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  defaultValue: Nullable extends true ? boolean | null | undefined : boolean | undefined
  stackTrail: StackTrail
}

export const toParsedBoolean = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value,
  stackTrail
}: ToParsedBooleanArgs<Nullable>): OasBoolean<Nullable> => {
  if (!v.is(oasBooleanData, value)) {
    v.parse(oasBooleanData, value)
  }

  const { type: _type, title, description, readOnly, writeOnly, deprecated, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    stackTrail,
    parentType: 'schema:boolean'
  })

  return context.withStackTrail(stackTrail, () =>
    new OasBoolean(
      {
        nullable,
        title,
        description,
        example,
        enums: enums,
        default: defaultValue,
        extensionFields,
        readOnly,
        writeOnly,
        deprecated
      },
      context
    )
  )
}

type ParseExampleArgs = {
  example: unknown
  context: ParseContextType
  parent: unknown
  nullable: boolean | undefined
  stackTrail: StackTrail
}

const parseExample = ({ example, context, parent, nullable, stackTrail }: ParseExampleArgs) => {
  if (example === undefined) {
    return undefined
  }

  if (nullable && example === null) {
    return example
  }

  if (typeof example !== 'boolean') {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "boolean", got: ${example}`,
      parent,
      stackTrail,
      type: 'INVALID_EXAMPLE'
    })
    return undefined
  }

  return example
}

type ParseDefaultArgs = {
  defaultValue: unknown
  context: ParseContextType
  parent: unknown
  nullable: boolean | undefined
  stackTrail: StackTrail
}

const parseDefault = ({
  defaultValue,
  context,
  parent,
  nullable,
  stackTrail
}: ParseDefaultArgs) => {
  if (defaultValue === undefined) {
    return undefined
  }

  if (nullable && defaultValue === null) {
    return defaultValue
  }

  if (typeof defaultValue !== 'boolean') {
    context.logIssue({
      key: 'default',
      level: 'warning',
      message: `Removed invalid default. Expected "boolean", got: ${defaultValue}`,
      parent,
      stackTrail,
      type: 'INVALID_DEFAULT'
    })
    return undefined
  }

  return defaultValue
}

const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean'
}
