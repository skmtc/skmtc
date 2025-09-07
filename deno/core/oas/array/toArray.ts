import type { OpenAPIV3 } from 'openapi-types'
import { OasArray } from './Array.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { parseNullable } from '../_helpers/parseNullable.ts'
import { parseExample } from '../_helpers/parseExample.ts'
import { parseEnum } from '../_helpers/parseEnum.ts'
import * as v from 'valibot'
import { oasArrayDataWithoutItems } from './array-types.ts'
import { parseDefault } from '../_helpers/parseDefault.ts'
type ToArrayArgs = {
  value: OpenAPIV3.ArraySchemaObject
  context: ParseContext
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
export const toArray = ({ value, context }: ToArrayArgs): OasArray => {
  const { nullable, value: valueWithoutNullable } = parseNullable({
    value,
    context
  })

  const { example, value: valueWithoutExample } = parseExample({
    value: valueWithoutNullable,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  const { enum: enums, value: valueWithoutEnums } = parseEnum({
    value: valueWithoutExample,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  const { default: defaultValue, value: valueWithoutDefault } = parseDefault({
    value: valueWithoutEnums,
    nullable,
    valibotSchema: v.array(v.any()),
    context
  })

  return toParsedArray({
    context,
    nullable,
    example,
    enums,
    defaultValue,
    value: valueWithoutDefault
  })
}

type ToParsedArrayArgs<Nullable extends boolean | undefined> = {
  value: Omit<OpenAPIV3.ArraySchemaObject, 'nullable' | 'example' | 'enums' | 'default'>
  context: ParseContext
  nullable: Nullable
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  enums: Nullable extends true ? (unknown[] | null)[] | undefined : unknown[] | undefined
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
}

/**
 * Creates an OAS array instance from pre-parsed array schema components.
 * 
 * This function is the final step in the array transformation pipeline, taking
 * already-parsed nullable, example, enum, and default values and combining them
 * with the remaining array properties to create the complete OasArray instance.
 * 
 * The function handles type-safe nullable parsing, items schema resolution,
 * and specification extension processing. It uses Valibot for schema validation
 * and maintains proper type relationships between nullable flags and value types.
 * 
 * @template Nullable - Boolean type indicating if the array can be null
 * @param args - Pre-parsed array components
 * @param args.value - OpenAPI array object without parsed fields
 * @param args.context - Parse context for tracing and utilities
 * @param args.nullable - Parsed nullable flag
 * @param args.example - Parsed example value (type-safe with nullable)
 * @param args.enums - Parsed enumeration constraints (type-safe with nullable)
 * @param args.defaultValue - Parsed default value (type-safe with nullable)
 * @returns Complete OAS array instance with all properties
 * 
 * @example Type-safe nullable array
 * ```typescript
 * const nullableArray = toParsedArray({
 *   context: parseContext,
 *   nullable: true,
 *   example: [1, 2, 3], // Can be null due to nullable: true
 *   enums: [[1], [2], null], // Null allowed in enums
 *   defaultValue: null,
 *   value: {
 *     type: 'array',
 *     items: { type: 'number' },
 *     maxItems: 5
 *   }
 * });
 * ```
 * 
 * @example Non-nullable array
 * ```typescript
 * const regularArray = toParsedArray({
 *   context: parseContext,
 *   nullable: false,
 *   example: ['a', 'b'], // Cannot be null
 *   enums: [['x'], ['y']], // No null values allowed
 *   defaultValue: [],
 *   value: {
 *     type: 'array',
 *     items: { type: 'string' }
 *   }
 * });
 * ```
 */
export const toParsedArray = <Nullable extends boolean | undefined>({
  context,
  nullable,
  example,
  enums,
  defaultValue,
  value
}: ToParsedArrayArgs<Nullable>): OasArray<Nullable> => {
  // We only want parse non-items fields here since items is handled below
  const { items, ...rest } = value

  // Parse the object without items field
  const parsed = v.parse(oasArrayDataWithoutItems, rest)
  const {
    type: _type,
    title,
    description,
    uniqueItems,
    maxItems,
    minItems,
    ...skipped
  } = parsed

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
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
    items: context.trace('items', () => toSchemaV3({ schema: items, context })),
    extensionFields,
    example,
    uniqueItems,
    maxItems,
    minItems,
    enums
  })
}
