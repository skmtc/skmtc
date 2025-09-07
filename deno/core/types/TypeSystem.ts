import type { OasRef } from '../oas/ref/Ref.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import type { Modifiers } from './Modifiers.ts'
import type { Stringable } from '../dsl/Stringable.ts'
import type { GenerateContext } from '../context/GenerateContext.ts'
import type { CustomValue } from './CustomValue.ts'
import type { OasVoid } from '../oas/void/Void.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import type { RefName } from './RefName.ts'

/**
 * Union type representing all possible type system values in the SKMTC code generation system.
 * 
 * The `TypeSystemValue` represents the normalized intermediate representation used by SKMTC
 * to convert OpenAPI schemas into target language types. This type system abstracts away
 * OpenAPI-specific details and provides a consistent interface for generating code in
 * different target languages and frameworks.
 * 
 * ## Type Categories
 * 
 * - **Primitive Types**: `string`, `number`, `integer`, `boolean`, `null`
 * - **Complex Types**: `array`, `object`, `union`
 * - **Special Types**: `void`, `never`, `unknown`, `custom`
 * - **Reference Types**: `ref` for schema references
 * 
 * @example Discriminated union usage
 * ```typescript
 * import { TypeSystemValue } from '@skmtc/core';
 * 
 * function processType(type: TypeSystemValue): string {
 *   switch (type.type) {
 *     case 'string':
 *       return `string${type.modifiers.optional ? '?' : ''}`;
 *     case 'array':
 *       return `${processType(type.items)}[]`;
 *     case 'object':
 *       return 'object';
 *     case 'ref':
 *       return type.name;
 *     default:
 *       return type.type;
 *   }
 * }
 * ```
 * 
 * @example In generator contexts
 * ```typescript
 * class TypeScriptGenerator {
 *   generateType(typeValue: TypeSystemValue): string {
 *     if (typeValue.type === 'union') {
 *       return typeValue.members
 *         .map(member => this.generateType(member))
 *         .join(' | ');
 *     }
 *     
 *     if (typeValue.type === 'array') {
 *       return `${this.generateType(typeValue.items)}[]`;
 *     }
 *     
 *     // Handle other types...
 *     return typeValue.type;
 *   }
 * }
 * ```
 */
export type TypeSystemValue =
  | TypeSystemArray
  | TypeSystemObject
  | TypeSystemUnion
  | TypeSystemString
  | TypeSystemNumber
  | TypeSystemInteger
  | TypeSystemBoolean
  | TypeSystemUnknown
  | TypeSystemVoid
  | TypeSystemNever
  | TypeSystemRef
  | TypeSystemNull
  | TypeSystemCustom

/**
 * Type system representation of a reference to another schema.
 * 
 * `TypeSystemRef` represents references to other schemas, typically used for
 * complex types that are defined elsewhere in the schema and referenced
 * through `$ref` in OpenAPI specifications.
 * 
 * @example
 * ```typescript
 * const userRef: TypeSystemRef = {
 *   type: 'ref',
 *   name: 'User',
 *   modifiers: { optional: false, nullable: false },
 *   generatorKey: 'model|User'
 * };
 * ```
 */
export type TypeSystemRef = {
  /** Discriminator for the reference type */
  type: 'ref'
  /** The name of the referenced schema */
  name: string
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation for custom, generator-specific types.
 * 
 * `TypeSystemCustom` allows generators to inject custom type representations
 * that don't fit into standard OpenAPI types. The value is a `Stringable`
 * that will be rendered directly in the generated code.
 * 
 * @example
 * ```typescript
 * const customType: TypeSystemCustom = {
 *   type: 'custom',
 *   value: 'React.ReactNode',
 *   generatorKey: 'react-component|Button'
 * };
 * ```
 */
export type TypeSystemCustom = {
  /** Discriminator for the custom type */
  type: 'custom'
  /** The custom type value to be rendered */
  value: Stringable
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of array types.
 * 
 * @example
 * ```typescript
 * const stringArray: TypeSystemArray = {
 *   type: 'array',
 *   items: { type: 'string', modifiers: { optional: false, nullable: false } },
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemArray = {
  /** Discriminator for the array type */
  type: 'array'
  /** The type of items in the array */
  items: TypeSystemValue
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of floating-point number types.
 * 
 * @example
 * ```typescript
 * const priceType: TypeSystemNumber = {
 *   type: 'number',
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemNumber = {
  /** Discriminator for the number type */
  type: 'number'
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of void types (no value).
 * 
 * @example
 * ```typescript
 * const voidType: TypeSystemVoid = {
 *   type: 'void'
 * };
 * ```
 */
export type TypeSystemVoid = {
  /** Discriminator for the void type */
  type: 'void'
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of never types (impossible values).
 * 
 * @example
 * ```typescript
 * const neverType: TypeSystemNever = {
 *   type: 'never'
 * };
 * ```
 */
export type TypeSystemNever = {
  /** Discriminator for the never type */
  type: 'never'
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of integer number types.
 * 
 * @example
 * ```typescript
 * const countType: TypeSystemInteger = {
 *   type: 'integer',
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemInteger = {
  /** Discriminator for the integer type */
  type: 'integer'
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of boolean types.
 * 
 * @example
 * ```typescript
 * const flagType: TypeSystemBoolean = {
 *   type: 'boolean',
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemBoolean = {
  /** Discriminator for the boolean type */
  type: 'boolean'
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of unknown types.
 * 
 * @example
 * ```typescript
 * const unknownType: TypeSystemUnknown = {
 *   type: 'unknown'
 * };
 * ```
 */
export type TypeSystemUnknown = {
  /** Discriminator for the unknown type */
  type: 'unknown'
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of null types.
 * 
 * @example
 * ```typescript
 * const nullType: TypeSystemNull = {
 *   type: 'null'
 * };
 * ```
 */
export type TypeSystemNull = {
  /** Discriminator for the null type */
  type: 'null'
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of record types (key-value mappings).
 * 
 * @example
 * ```typescript
 * const recordType: TypeSystemRecord = {
 *   value: { type: 'string', modifiers: { optional: false, nullable: false } }
 * };
 * ```
 */
export type TypeSystemRecord = {
  /** The type of values in the record, or 'true' for any value */
  value: TypeSystemValue | 'true'
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of object properties.
 * 
 * @example
 * ```typescript
 * const objectProps: TypeSystemObjectProperties = {
 *   properties: {
 *     name: { type: 'string', modifiers: { optional: false, nullable: false } },
 *     age: { type: 'integer', modifiers: { optional: true, nullable: false } }
 *   }
 * };
 * ```
 */
export type TypeSystemObjectProperties = {
  /** Map of property names to their types */
  properties: Record<string, TypeSystemValue>
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of string types.
 * 
 * @example
 * ```typescript
 * const emailString: TypeSystemString = {
 *   type: 'string',
 *   format: 'email',
 *   enums: undefined,
 *   modifiers: { optional: false, nullable: false }
 * };
 * 
 * const statusEnum: TypeSystemString = {
 *   type: 'string',
 *   format: undefined,
 *   enums: ['active', 'inactive', 'pending'],
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemString = {
  /** Discriminator for the string type */
  type: 'string'
  /** String format specification (email, uuid, date-time, etc.) */
  format: string | undefined
  /** Array of allowed enum values */
  enums: string[] | (string | null)[] | undefined
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of union types.
 * 
 * @example
 * ```typescript
 * const stringOrNumber: TypeSystemUnion = {
 *   type: 'union',
 *   members: [
 *     { type: 'string', modifiers: { optional: false, nullable: false } },
 *     { type: 'number', modifiers: { optional: false, nullable: false } }
 *   ],
 *   discriminator: undefined,
 *   modifiers: { optional: false, nullable: false }
 * };
 * 
 * const discriminatedUnion: TypeSystemUnion = {
 *   type: 'union',
 *   members: [userType, adminType, guestType],
 *   discriminator: 'type',
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemUnion = {
  /** Discriminator for the union type */
  type: 'union'
  /** Array of types that are part of the union */
  members: TypeSystemValue[]
  /** Optional discriminator property name for tagged unions */
  discriminator: string | undefined
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Type system representation of object types.
 * 
 * Objects can have either fixed properties (objectProperties) or
 * dynamic key-value pairs (recordProperties), or both.
 * 
 * @example Fixed properties object
 * ```typescript
 * const userObject: TypeSystemObject = {
 *   type: 'object',
 *   recordProperties: null,
 *   objectProperties: {
 *     properties: {
 *       id: { type: 'string', modifiers: { optional: false, nullable: false } },
 *       name: { type: 'string', modifiers: { optional: false, nullable: false } },
 *       email: { type: 'string', modifiers: { optional: true, nullable: false } }
 *     }
 *   },
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 * 
 * @example Record-like object
 * ```typescript
 * const configObject: TypeSystemObject = {
 *   type: 'object',
 *   recordProperties: {
 *     value: { type: 'string', modifiers: { optional: false, nullable: false } }
 *   },
 *   objectProperties: null,
 *   modifiers: { optional: false, nullable: false }
 * };
 * ```
 */
export type TypeSystemObject = {
  /** Discriminator for the object type */
  type: 'object'
  /** Dynamic key-value properties (Record<string, T>) */
  recordProperties: TypeSystemRecord | null
  /** Fixed object properties with known keys */
  objectProperties: TypeSystemObjectProperties | null
  /** Type modifiers (optional, nullable, etc.) */
  modifiers: Modifiers
  /** Optional generator-specific key for tracking */
  generatorKey?: GeneratorKey
}

/**
 * Mapping of schema types to their type system representations.
 * 
 * This type maps OpenAPI schema types to their corresponding type system
 * value types, enabling type-safe transformations during code generation.
 * 
 * @example
 * ```typescript
 * // Used internally by the type system transformation process
 * type StringOutput = SchemaToTypeSystemMap['string']['output']; // TypeSystemString
 * type RefSource = SchemaToTypeSystemMap['ref']['source']; // OasRef<'schema'>
 * ```
 */
export type SchemaToTypeSystemMap = {
  ref: {
    source: OasRef<'schema'>
    output: TypeSystemRef
  }
  array: {
    source: OasSchema
    output: TypeSystemArray
  }
  number: {
    source: OasSchema
    output: TypeSystemNumber
  }
  void: {
    source: OasVoid
    output: TypeSystemVoid
  }
  integer: {
    source: OasSchema
    output: TypeSystemInteger
  }
  boolean: {
    source: OasSchema
    output: TypeSystemBoolean
  }
  unknown: {
    source: OasSchema
    output: TypeSystemUnknown
  }
  null: {
    source: OasSchema
    output: TypeSystemNull
  }
  object: {
    source: OasSchema
    output: TypeSystemObject
  }
  string: {
    source: OasSchema
    output: TypeSystemString
  }
  union: {
    source: OasSchema
    output: TypeSystemUnion
  }
  custom: {
    source: CustomValue
    output: TypeSystemCustom
  }
}

/**
 * Union of all possible schema types that can be transformed.
 * 
 * @example
 * ```typescript
 * function transformSchema(schema: SchemaType): TypeSystemValue {
 *   // Transform any schema type to its type system representation
 *   return toTypeSystemValue(schema);
 * }
 * ```
 */
export type SchemaType = OasSchema | OasRef<'schema'> | OasVoid | CustomValue

/**
 * Extracts only reference types from a schema type.
 * 
 * @template Schema - The schema type to filter
 * @example
 * ```typescript
 * type RefOnly = SchemaToRef<OasRef<'schema'>>; // OasRef<'schema'>
 * type NeverForSchema = SchemaToRef<OasSchema>; // never
 * ```
 */
export type SchemaToRef<Schema extends SchemaType> =
  Schema extends OasRef<'schema'> ? Schema : never

/**
 * Extracts only non-reference types from a schema type.
 * 
 * @template Schema - The schema type to filter
 * @example
 * ```typescript
 * type SchemaOnly = SchemaToNonRef<OasSchema>; // OasSchema
 * type NeverForRef = SchemaToNonRef<OasRef<'schema'>>; // never
 * ```
 */
export type SchemaToNonRef<Schema extends SchemaType> =
  Schema extends OasRef<'schema'> ? never : Schema

/**
 * Gets the output type for a given schema type key.
 * 
 * @template T - The schema type key
 * @example
 * ```typescript
 * type StringOutput = TypeSystemOutput<'string'>; // TypeSystemString
 * type ArrayOutput = TypeSystemOutput<'array'>; // TypeSystemArray
 * ```
 */
export type TypeSystemOutput<T extends keyof SchemaToTypeSystemMap> =
  SchemaToTypeSystemMap[T]['output']

/**
 * Arguments for type system transformation functions.
 * 
 * @template Schema - The specific schema type being transformed
 * @example
 * ```typescript
 * function transformStringSchema(args: TypeSystemArgs<OasSchema>): TypeSystemString {
 *   const { context, schema, required } = args;
 *   // Transform string schema to type system representation
 *   return {
 *     type: 'string',
 *     format: schema.format,
 *     enums: schema.enums,
 *     modifiers: { optional: !required, nullable: schema.nullable }
 *   };
 * }
 * ```
 */
export type TypeSystemArgs<Schema extends SchemaType> = {
  /** The generation context containing utilities and state */
  context: GenerateContext
  /** The destination path for the generated artifact */
  destinationPath: string
  /** The schema to transform */
  schema: Schema
  /** Optional root reference name for schema references */
  rootRef?: RefName
  /** Whether the schema field is required */
  required: boolean | undefined
}

/**
 * Function type for transforming schemas to type system values.
 * 
 * @template Schema - The schema type being transformed
 * @param args - Transformation arguments
 * @returns The corresponding type system value
 * 
 * @example
 * ```typescript
 * const transformSchema: SchemaToValueFn = (args) => {
 *   switch (args.schema.type) {
 *     case 'string':
 *       return transformStringSchema(args);
 *     case 'object':
 *       return transformObjectSchema(args);
 *     // ... other cases
 *     default:
 *       throw new Error(`Unknown schema type: ${args.schema.type}`);
 *   }
 * };
 * ```
 */
export type SchemaToValueFn = <Schema extends SchemaType>(
  args: TypeSystemArgs<Schema>
) => TypeSystemOutput<Schema['type']>
