import type { OasArray } from '../array/Array.ts'
import type { OasBoolean } from '../boolean/Boolean.ts'
import type { OasInteger } from '../integer/Integer.ts'
import type { OasNumber } from '../number/Number.ts'
import type { OasObject } from '../object/Object.ts'
import type { OasString } from '../string/String.ts'
import type { OasUnknown } from '../unknown/Unknown.ts'
import type { OasUnion } from '../union/Union.ts'

/**
 * Union type representing all possible OpenAPI Schema objects in the SKMTC system.
 * 
 * `OasSchema` is the fundamental type for representing any OpenAPI schema definition
 * after it has been parsed and processed by the SKMTC pipeline. It encompasses all
 * JSON Schema types supported by OpenAPI 3.x specifications, providing type-safe
 * access to schema properties and validation constraints.
 * 
 * This union type is used throughout the system for schema processing, type generation,
 * and validation. Each variant corresponds to a specific JSON Schema type with its
 * own set of properties and validation rules.
 * 
 * ## Supported Schema Types
 * 
 * - **{@link OasArray}**: Array schemas with item type definitions and constraints
 * - **{@link OasBoolean}**: Boolean schemas with optional default values
 * - **{@link OasInteger}**: Integer schemas with numeric constraints and formats
 * - **{@link OasNumber}**: Number schemas with numeric constraints and formats
 * - **{@link OasObject}**: Object schemas with properties, required fields, and constraints
 * - **{@link OasString}**: String schemas with length constraints, patterns, and formats
 * - **{@link OasUnknown}**: Schemas with unknown or mixed types
 * - **{@link OasUnion}**: Union schemas representing oneOf/anyOf/allOf constructs
 * 
 * @example Type checking and processing
 * ```typescript
 * import type { OasSchema } from '@skmtc/core';
 * 
 * function processSchema(schema: OasSchema): string {
 *   if (schema.type === 'object') {
 *     // TypeScript knows this is OasObject
 *     return `Object with ${Object.keys(schema.properties || {}).length} properties`;
 *   } else if (schema.type === 'array') {
 *     // TypeScript knows this is OasArray
 *     return `Array of ${schema.items.type} items`;
 *   } else if (schema.type === 'string') {
 *     // TypeScript knows this is OasString
 *     return `String${schema.format ? ` (${schema.format})` : ''}`;
 *   }
 *   // Handle other types...
 *   return `${schema.type} type`;
 * }
 * ```
 * 
 * @example Schema validation and constraints
 * ```typescript
 * function validateSchemaConstraints(schema: OasSchema, value: unknown): boolean {
 *   switch (schema.type) {
 *     case 'string':
 *       if (typeof value !== 'string') return false;
 *       if (schema.minLength && value.length < schema.minLength) return false;
 *       if (schema.maxLength && value.length > schema.maxLength) return false;
 *       if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
 *       return true;
 * 
 *     case 'integer':
 *     case 'number':
 *       if (typeof value !== 'number') return false;
 *       if (schema.minimum && value < schema.minimum) return false;
 *       if (schema.maximum && value > schema.maximum) return false;
 *       return true;
 * 
 *     case 'array':
 *       if (!Array.isArray(value)) return false;
 *       if (schema.minItems && value.length < schema.minItems) return false;
 *       if (schema.maxItems && value.length > schema.maxItems) return false;
 *       return true;
 * 
 *     default:
 *       return true;
 *   }
 * }
 * ```
 * 
 * @example Code generation based on schema type
 * ```typescript
 * class TypeScriptGenerator {
 *   generateType(schema: OasSchema): string {
 *     switch (schema.type) {
 *       case 'object':
 *         return this.generateInterface(schema);
 *       case 'array':
 *         return `Array<${this.generateType(schema.items)}>`;
 *       case 'string':
 *         if (schema.enums) {
 *           return schema.enums.map(e => `'${e}'`).join(' | ');
 *         }
 *         return 'string';
 *       case 'integer':
 *       case 'number':
 *         return 'number';
 *       case 'boolean':
 *         return 'boolean';
 *       case 'union':
 *         return schema.variants.map(v => this.generateType(v)).join(' | ');
 *       default:
 *         return 'unknown';
 *     }
 *   }
 * }
 * ```
 */
export type OasSchema =
  | OasArray
  | OasBoolean
  | OasInteger
  | OasNumber
  | OasObject
  | OasString
  | OasUnknown
  | OasUnion

/**
 * Configuration options for JSON Schema conversion operations.
 * 
 * These options control how OAS schemas are converted back to JSON Schema format,
 * particularly around reference resolution and schema inlining behavior.
 * 
 * @example
 * ```typescript
 * const options: ToJsonSchemaOptions = {
 *   resolve: true  // Resolve $ref references during conversion
 * };
 * 
 * const jsonSchema = schema.toJsonSchema(options);
 * ```
 */
export type ToJsonSchemaOptions = {
  /** Whether to resolve $ref references during conversion (default: false) */
  resolve: boolean
}
