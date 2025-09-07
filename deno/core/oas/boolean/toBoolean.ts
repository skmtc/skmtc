import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasBoolean } from './Boolean.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import { oasBooleanData } from './boolean-types.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'

type ToBooleanArgs = {
  value: OpenAPIV3.SchemaObject
  context: ParseContext
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
export const toBoolean = ({ value, context }: ToBooleanArgs): OasBoolean => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  const { default: defaultValue, value: valueWithoutDefault } = parseDefault({
    value: valueWithoutEnums,
    nullable,
    valibotSchema: v.boolean(),
    context
  })

  return toParsedBoolean({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault
  })
}

type ToParsedBooleanArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enums'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  defaultValue: Nullable extends true ? boolean | null | undefined : boolean | undefined
}

export const toParsedBoolean = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedBooleanArgs<Nullable>): OasBoolean<Nullable> => {
  const { type: _type, title, description, ...skipped } = v.parse(oasBooleanData, value)

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: 'schema:boolean'
  })

  return new OasBoolean({
    nullable,
    title,
    description,
    example,
    enums: enums,
    default: defaultValue,
    extensionFields
  })
}
