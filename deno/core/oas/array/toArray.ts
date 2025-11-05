import type { OpenAPIV3 } from 'openapi-types'
import { OasArray } from './Array.ts'
import { toSchemaV3 } from '@/oas/schema/toSchemasV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import { oasArrayDataWithoutItems } from './array-types.ts'
import { tracer } from '../../helpers/tracer.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

type ToArrayArgs = {
  value: OpenAPIV3.ArraySchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Transforms an OpenAPI v3 array schema object into an internal OAS array representation.
 *
 * This function processes OpenAPI array schemas by extracting and parsing nullable values,
 * examples, enumerations, and default values. It handles the complete transformation from
 * raw OpenAPI JSON to the SKMTC internal array representation with proper type safety.
 *
 * The transformation follows a pipeline approach:
 * 1. Parse nullable flag and extract base value
 * 2. Parse example values with nullable support
 * 3. Parse enumeration constraints
 * 4. Parse default values
 * 5. Create final OasArray instance
 *
 * @param args - Transformation arguments
 * @param args.value - The OpenAPI v3 array schema object to transform
 * @param args.context - Parse context providing utilities and tracing
 * @returns Transformed OAS array object with parsed properties
 *
 * @example Basic array transformation
 * ```typescript
 * import { toArray } from '@skmtc/core';
 *
 * const openApiArray = {
 *   type: 'array',
 *   items: { type: 'string' },
 *   maxItems: 10,
 *   uniqueItems: true
 * };
 *
 * const oasArray = toArray({
 *   value: openApiArray,
 *   context: parseContext
 * });
 *
 * console.log(oasArray.maxItems); // 10
 * console.log(oasArray.uniqueItems); // true
 * ```
 *
 * @example Array with nullable and examples
 * ```typescript
 * const complexArray = {
 *   type: 'array',
 *   items: { type: 'number' },
 *   nullable: true,
 *   example: [1, 2, 3],
 *   default: [],
 *   enum: [[1, 2], [3, 4], null]
 * };
 *
 * const oasArray = toArray({
 *   value: complexArray,
 *   context: parseContext
 * });
 *
 * console.log(oasArray.nullable); // true
 * console.log(oasArray.example); // [1, 2, 3]
 * ```
 */
export const toArray = ({ value, context, stackTrail }: ToArrayArgs): OasArray => {
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

  const { enum: unparsedEnums, ...valueWithoutEnums } = valueWithoutExample

  const enums = parseEnum({
    value: unparsedEnums,
    nullable,
    stackTrail,
    parent: valueWithoutExample,
    context,
    check: Array.isArray,
    toMessage: item => `Removed invalid enum. Expected "array", got: ${item}`
  })

  const { default: unparsedDefaultValue, ...valueWithoutDefault } = valueWithoutEnums

  const defaultValue = parseDefault({
    defaultValue: unparsedDefaultValue,
    context,
    parent: valueWithoutEnums,
    nullable,
    stackTrail
  })

  return toParsedArray({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    stackTrail,
    value: valueWithoutDefault as Omit<
      OpenAPIV3.ArraySchemaObject,
      'nullable' | 'example' | 'enums' | 'default'
    >
  })
}

type ToParsedArrayArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.ArraySchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  stackTrail: StackTrail
  context: ParseContextType
  nullable: Nullable
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  enums: Nullable extends true ? (unknown[] | null)[] | undefined : unknown[] | undefined
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
}

export const toParsedArray = <Nullable extends boolean | undefined>({
  context,
  stackTrail,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedArrayArgs<Nullable>): OasArray<Nullable> => {
  // We only want parse non-items fields here since items is handled below
  const { items, ...rest } = value

  // Parse the object without items field
  if (!v.is(oasArrayDataWithoutItems, rest)) {
    v.parse(oasArrayDataWithoutItems, rest)
  }

  const {
    type: _type,
    title,
    description,
    uniqueItems,
    maxItems,
    minItems,
    readOnly,
    writeOnly,
    deprecated,
    ...skipped
  } = rest

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    stackTrail,
    parentType: 'schema:array'
  })

  // if (!items) {
  //   console.log(JSON.stringify(value, null, 2))
  //   throw new Error('No items')
  // }

  return new OasArray({
    title,
    description,
    nullable,
    defaultValue,
    items: stackTrail.trace('items', st => toSchemaV3({ schema: items, stackTrail: st, context })),
    extensionFields,
    example,
    uniqueItems,
    maxItems,
    minItems,
    enums,
    readOnly,
    writeOnly,
    deprecated
  })
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

  if (!Array.isArray(example)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Removed invalid example. Expected "array", got: ${example}`,
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

  if (!Array.isArray(defaultValue)) {
    context.logIssue({
      key: 'default',
      level: 'warning',
      message: `Invalid default: ${defaultValue}`,
      parent,
      stackTrail,
      type: 'INVALID_DEFAULT'
    })
    return undefined
  }

  return defaultValue
}
