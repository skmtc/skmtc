# Appendix — generated API reference

> Generated from framework source at `71ef53bc` by
> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`
> (from `deno/`). **Authoritative** for signatures, fields, and doc
> comments — trust it instead of re-reading package source. JSDoc
> `@example` blocks are stripped at generation. For a symbol not
> listed here, `deno doc <file> <Symbol>` against the framework
> source beats grepping it.

### `@skmtc/core` — the OAS IR a generator reads

The schema classes handed to `transform` / projections via `resolveSchemaRefOnce` and friends: every `OasSchema` variant with its exact fields, plus `OasRef`, `CustomValue`, and the discriminator. Wire facts (`readOnly` / `writeOnly` / `format` / `enums` / `default`) live on the concrete variants listed here. Type facts are read inside the router's per-type case (which already holds the narrowed variant); position facts are read with the `in` operator — never a `.type` branch outside the router.

### `core/oas/schema/Schema.ts`

```text
Defined in deno/core/oas/schema/Schema.ts:110:1

type OasSchema = OasArray | OasBoolean | OasInteger | OasNumber | OasObject | OasString | OasUnknown | OasUnion
  Union type representing all possible OpenAPI Schema objects in the SKMTC system.

  `OasSchema` is the fundamental type for representing any OpenAPI schema definition
  after it has been parsed and processed by the SKMTC pipeline. It encompasses all
  JSON Schema types supported by OpenAPI 3.x specifications, providing type-safe
  access to schema properties and validation constraints.

  This union type is used throughout the system for schema processing, type generation,
  and validation. Each variant corresponds to a specific JSON Schema type with its
  own set of properties and validation rules.

  ## Supported Schema Types

  - {@link OasArray}: Array schemas with item type definitions and constraints
  - {@link OasBoolean}: Boolean schemas with optional default values
  - {@link OasInteger}: Integer schemas with numeric constraints and formats
  - {@link OasNumber}: Number schemas with numeric constraints and formats
  - {@link OasObject}: Object schemas with properties, required fields, and constraints
  - {@link OasString}: String schemas with length constraints, patterns, and formats
  - {@link OasUnknown}: Schemas with unknown or mixed types
  - {@link OasUnion}: Union schemas representing oneOf/anyOf/allOf constructs

Defined in deno/core/oas/schema/Schema.ts:135:1

type ToJsonSchemaOptions = { resolve: boolean; }
  Configuration options for JSON Schema conversion operations.

  These options control how OAS schemas are converted back to JSON Schema format,
  particularly around reference resolution and schema inlining behavior.
```
### `core/oas/string/String.ts`

```text
Defined in deno/core/oas/string/String.ts:44:1

class OasString<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: StringFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "string"
    Constant value 'string' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the string.
  description: string | undefined
    A description of the string.
  format: string | undefined
    The format of the string.
  enums: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
    An array of allowed values for the string.
  maxLength: number | undefined
    The maximum length of the string.
  minLength: number | undefined
    The minimum length of the string.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? string | null | undefined : string | undefined
    An example of the string.
  pattern: string | undefined
    The pattern of the string.
  default: Nullable extends true ? string | null | undefined : string | undefined
    The default value of the string.
  readOnly: boolean | undefined
    Whether the string is read-only.
  writeOnly: boolean | undefined
    Whether the string is write-only.
  deprecated: boolean | undefined
    Whether the string is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasString<Nullable>
  resolveOnce(): OasString<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/string/String.ts:13:1

type StringFields<Nullable extends boolean | undefined> = { title?: string; description?: string; format?: string; default?: Nullable extends true ? string | null | undefined : string | undefined; pattern?: string; enums?: Nullable extends true ? (string | null)[] | undefined : string[] | undefined; maxLength?: number; minLength?: number; nullable?: Nullable; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? string | null | undefined : string | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasString}.

  @template Nullable
      Whether the string value can be null
```
### `core/oas/integer/Integer.ts`

```text
Defined in deno/core/oas/integer/Integer.ts:47:1

class OasInteger<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: IntegerFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "integer"
    Constant value 'integer' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the integer.
  description: string | undefined
    A description of the integer.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  format: "int32" | "int64" | undefined
    The format of the integer.
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
    An array of allowed values for the integer.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? number | null | undefined : number | undefined
    An example of the integer.
  multipleOf: number | undefined
    The multiple of the integer.
  maximum: number | undefined
    The maximum value of the integer.
  exclusiveMaximum: boolean | undefined
    Whether the maximum value is exclusive.
  minimum: number | undefined
    The minimum value of the integer.
  exclusiveMinimum: boolean | undefined
    Whether the minimum value is exclusive.
  default: Nullable extends true ? number | null | undefined : number | undefined
    The default value of the integer.
  readOnly: boolean | undefined
    Whether the integer is read-only.
  writeOnly: boolean | undefined
    Whether the integer is write-only.
  deprecated: boolean | undefined
    Whether the integer is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasInteger<Nullable>
  resolveOnce(): OasInteger<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/integer/Integer.ts:12:1

type IntegerFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; format?: "int32" | "int64"; default?: Nullable extends true ? number | null | undefined : number | undefined; enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? number | null | undefined : number | undefined; multipleOf?: number; maximum?: number; exclusiveMaximum?: boolean; minimum?: number; exclusiveMinimum?: boolean; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasInteger}.

  @template Nullable
      Whether the integer value can be null
```
### `core/oas/number/Number.ts`

```text
Defined in deno/core/oas/number/Number.ts:48:1

class OasNumber<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: NumberFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "number"
    Constant value 'number' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the number.
  default: Nullable extends true ? number | null | undefined : number | undefined
    The default value of the number.
  description: string | undefined
    A description of the number.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? number | null | undefined : number | undefined
    An example of the number.
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
    An array of allowed values for the number.
  format: "float" | "double" | undefined
    The format of the number.
  multipleOf: number | undefined
    The multiple of the number.
  maximum: number | undefined
    The maximum value of the number.
  exclusiveMaximum: boolean | undefined
    Whether the maximum value is exclusive.
  minimum: number | undefined
    The minimum value of the number.
  exclusiveMinimum: boolean | undefined
    Whether the minimum value is exclusive.
  readOnly: boolean | undefined
    Whether the number is read-only.
  writeOnly: boolean | undefined
    Whether the number is write-only.
  deprecated: boolean | undefined
    Whether the number is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasNumber<Nullable>
  resolveOnce(): OasNumber<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/number/Number.ts:13:1

type NumberFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; default?: Nullable extends true ? number | null | undefined : number | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? number | null | undefined : number | undefined; enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined; format?: "float" | "double"; multipleOf?: number; maximum?: number; exclusiveMaximum?: boolean; minimum?: number; exclusiveMinimum?: boolean; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasNumber}.

  @template Nullable
      Whether the number can be null (affects type unions)
```
### `core/oas/boolean/Boolean.ts`

```text
Defined in deno/core/oas/boolean/Boolean.ts:35:1

class OasBoolean<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: BooleanFields<Nullable>, context?: ParseContextType)
    Creates a new OasBoolean instance.

    @param fields
        Boolean configuration fields including validation constraints and metadata

    @param context
        Optional ParseContext. When passed and attribution is
        enabled, the current StackTrail is snapshotted onto the
        instance (via the {@link OasBase} base).

  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "boolean"
    Constant value 'boolean' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the boolean.
  description: string | undefined
    A description of the boolean.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined
    An example of the boolean.
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
    Possible values the boolean can have
  default: Nullable extends true ? boolean | null | undefined : boolean | undefined
    The default value of the boolean.
  readOnly: boolean | undefined
    Whether the boolean is read-only
  writeOnly: boolean | undefined
    Whether the boolean is write-only
  deprecated: boolean | undefined
    Whether the boolean is deprecated
  isRef(): this is OasRef<"schema">
    Determines if this boolean is a reference object.

    @return
        Always returns false since this is a concrete boolean instance, not a reference

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasBoolean<Nullable>
    Resolves this boolean object.

    @return
        The boolean instance itself since it's already a concrete object, not a reference

  resolveOnce(): OasBoolean<Nullable>
    Resolves this boolean object one level.

    @return
        The boolean instance itself since it's already a concrete object, not a reference

  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject
    Converts this OAS boolean to an OpenAPI v3 JSON schema representation.

    @param options
        Conversion options (currently unused for boolean schemas)

    @return
        OpenAPI v3 boolean schema object with type and all validation constraints

Defined in deno/core/oas/boolean/Boolean.ts:13:1

type BooleanFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? boolean | null | undefined : boolean | undefined; enums?: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined; default?: Nullable extends true ? boolean | null | undefined : boolean | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasBoolean}.

  @template Nullable
      Whether the boolean can be null (affects type unions)
```
### `core/oas/array/Array.ts`

```text
Defined in deno/core/oas/array/Array.ts:44:1

class OasArray<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: ArrayFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "array"
    Constant value 'array' useful for type narrowing and tagged unions.
  items: OasSchema | OasRef<"schema">
    Defines the type of items in the array.
  title: string | undefined
    A short summary of the array.
  description: string | undefined
    A description of the array.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  uniqueItems: boolean | undefined
    Indicates whether the array items must be unique.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
    An example of the array.
  maxItems: number | undefined
    The maximum number of items in the array.
  minItems: number | undefined
    The minimum number of items in the array.
  enums: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined
    The enum values for the array.
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
    The default value for the array.
  readOnly: boolean | undefined
    Whether the array is read-only.
  writeOnly: boolean | undefined
    Whether the array is write-only.
  deprecated: boolean | undefined
    Whether the array is deprecated.
  isRef(): this is OasRef<"schema">
    Determines if this array is a reference object.

    @return
        Always returns false since this is a concrete array instance, not a reference

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasArray<Nullable>
    Resolves this array object.

    @return
        The array instance itself since it's already a concrete object, not a reference

  resolveOnce(): OasArray<Nullable>
    Resolves this array object one level.

    @return
        The array instance itself since it's already a concrete object, not a reference

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ArraySchemaObject
    Converts this OAS array to an OpenAPI v3 JSON schema representation.

    @param options
        Conversion options including reference handling and formatting preferences

    @return
        OpenAPI v3 array schema object with type, items schema, and all validation constraints

Defined in deno/core/oas/array/Array.ts:13:1

type ArrayFields<Nullable extends boolean | undefined> = { items: OasSchema | OasRef<"schema">; title?: string; description?: string; nullable?: Nullable; uniqueItems?: boolean; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined; maxItems?: number; minItems?: number; enums?: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined; defaultValue?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasArray}.

  @template Nullable
      Whether the array value can be null
```
### `core/oas/object/Object.ts`

```text
Defined in deno/core/oas/object/Object.ts:153:1

class OasObject<Nullable extends boolean | undefined = boolean | undefined> extends OasBase
  Represents an object schema in the OpenAPI Specification.

  `OasObject` handles both:

  - Objects: Types with fixed, named properties (like TypeScript interfaces)
  - Records: Types with dynamic keys and consistent value types (like TypeScript Record<string, T>)

  This class provides comprehensive support for object validation constraints,
  property management, and JSON Schema conversion. It supports nullable types
  through generic type parameters and handles complex property relationships.

  ## Key Features

  - Property Management: Add/remove properties with automatic required field handling
  - Type Safety: Generic nullable type support with proper TypeScript inference
  - Validation: Min/max properties, additional properties, and enum constraints
  - JSON Schema: Convert to standard JSON Schema format for validation
  - Immutability: All mutations return new instances (functional style)

  @template Nullable
      Whether the object value itself can be null

  constructor(fields: OasObjectFields<Nullable>, context?: ParseContextType)
    Creates a new OasObject instance.

    @param fields
        Object configuration fields

  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "object"
    Constant value 'object' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the object.
  description: string | undefined
    A description of the object.
  externalDocs: OasExternalDocs | undefined
    External documentation for the object.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  properties: Nullable extends true ? Record<string, OasSchema | OasRef<"schema"> | CustomValue> | null | undefined : Record<string, OasSchema | OasRef<"schema"> | CustomValue> | undefined
    A record which maps property names of the object to their schemas.
  required: string[] | undefined
    An array of required property names.
  additionalProperties: boolean | OasSchema | OasRef<"schema"> | undefined
    Indicates whether additional properties are allowed.

    This is equivalent to a Record type in TypeScript.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined
    An example of the object.
  default: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined
    The default value of the object.
  maxProperties?: number
    Maximum number of properties allowed in the object
  minProperties?: number
    Minimum number of properties required in the object
  readOnly?: boolean
    Whether the object is read-only
  writeOnly?: boolean
    Whether the object is write-only
  deprecated?: boolean
    Whether the object schema is deprecated
  enums?: Nullable extends true ? (Record<string, unknown> | null)[] | undefined : Record<string, unknown>[] | undefined
    Array of valid enum values for the object
  static empty(): OasObject<false>
    Creates a new empty OasObject with no properties.

    This factory method creates a non-nullable object with empty properties
    and required arrays, useful as a starting point for dynamic object building.

    @return
        A new empty OasObject instance

  addProperty({name, schema, required}: AddPropertyArgs): OasObject
    Adds a new property to the object.

    This method returns a new OasObject instance with the added property,
    following an immutable pattern. If the property is marked as required,
    it will be added to the required array.

    @param args
        Property addition arguments

    @param args.name
        The name of the property to add

    @param args.schema
        The schema definition for the property

    @param args.required
        Whether the property should be required (default: false)

    @return
        A new OasObject with the added property

  removeProperty(name: string): OasObject
    Removes a property from the object.

    This method returns a new OasObject instance with the specified property
    removed. If the property was required, it will also be removed from the
    required array. If the property doesn't exist, returns the same instance.

    @param name
        The name of the property to remove

    @return
        A new OasObject with the property removed, or the same instance if property doesn't exist

  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasObject
  resolveOnce(): OasObject
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject
    Converts the OasObject to a standard JSON Schema object.

    This method serializes the object to the JSON Schema format used in
    OpenAPI specifications. It handles property conversion, additional
    properties rules, and validation constraints.

    @param options
        Conversion options for handling references and context

    @return
        A JSON Schema representation of the object

Defined in deno/core/oas/object/Object.ts:59:1

type AddPropertyArgs = { name: string; schema: OasSchema | OasRef<"schema"> | CustomValue | undefined; required?: boolean; }
  Arguments for the {@link OasObject.addProperty} method.

Defined in deno/core/oas/object/Object.ts:15:1

type OasObjectFields<Nullable extends boolean | undefined> = { title?: string; description?: string; externalDocs?: OasExternalDocs | undefined; properties?: Record<string, OasSchema | OasRef<"schema"> | CustomValue> | undefined; required?: string[] | undefined; default?: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined; additionalProperties?: boolean | OasSchema | OasRef<"schema"> | undefined; nullable?: Nullable; maxProperties?: number; minProperties?: number; enums?: Nullable extends true ? (Record<string, unknown> | null)[] | undefined : Record<string, unknown>[] | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasObject}.

  @template Nullable
      Whether the object can be null (affects type unions)
```
### `core/oas/union/Union.ts`

```text
Defined in deno/core/oas/union/Union.ts:147:1

class OasUnion extends OasBase
  Represents a union type schema in the OpenAPI Specification.

  `OasUnion` handles both OpenAPI `oneOf` and `anyOf` constructs by mapping them
  to TypeScript union types. While OpenAPI distinguishes between these concepts,
  in TypeScript they both represent union types (A | B | C), making the distinction
  less meaningful for code generation.

  This class supports both simple unions and discriminated (tagged) unions through
  the discriminator property, which enables more precise type narrowing in generated code.

  ## Key Features

  - Union Types: Represents multiple possible schema types as a single union
  - Tagged Unions: Supports discriminator properties for type narrowing
  - Reference Resolution: Handles references to other schemas within union members
  - Nullable Support: Can represent nullable union types (A | B | null)
  - JSON Schema: Converts to standard JSON Schema format for validation

  constructor(fields: UnionFields, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "union"
    Constant value 'union' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the union.
  description: string | undefined
    A description of the union.
  externalDocs: OasExternalDocs | undefined
    External documentation for the union.
  nullable: boolean | undefined
    Indicates whether value can be null.
  discriminator: OasDiscriminator | undefined
    Discriminator object used to tag member types and make the union a tagged union.
  members: (OasSchema | OasRef<"schema">)[]
    Array of schemas or references to schemas that are part of the union.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example?: unknown
    An example of the union type.
  default?: unknown
    The default value of the union type.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasUnion
  resolveOnce(): OasUnion
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/union/Union.ts:14:1

type UnionFields = { title?: string; description?: string; externalDocs?: OasExternalDocs | undefined; nullable?: boolean; discriminator?: OasDiscriminator; example?: unknown; default?: unknown; members: (OasSchema | OasRef<"schema">)[]; extensionFields?: Record<string, unknown>; }
  Constructor fields for {@link OasUnion}.
```
### `core/oas/unknown/Unknown.ts`

```text
Defined in deno/core/oas/unknown/Unknown.ts:23:1

class OasUnknown extends OasBase
  Object representing an unknown type in the OpenAPI Specification.

  JSON schema treats a definition without any type information as 'any'.
  Since this is not useful in an API context, we use OasUnknown to
  represent types that are not specified.

  constructor(fields: UnknownFields, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "unknown"
    Constant value 'unknown' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the unknown type.
  description: string | undefined
    A description of the unknown type.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: unknown | undefined
    An example of the unknown type.
  nullable: boolean | undefined
    Whether the unknown type is nullable
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasUnknown
  resolveOnce(): OasUnknown
  toJsonSchema(_options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject | OpenAPIV3.ArraySchemaObject

Defined in deno/core/oas/unknown/Unknown.ts:8:1

type UnknownFields = { title?: string; description?: string; extensionFields?: Record<string, unknown>; example?: unknown; nullable?: boolean; }
```
### `core/oas/ref/Ref.ts`

```text
Defined in deno/core/oas/ref/Ref.ts:157:1

class OasRef<T extends OasRefData["refType"]> extends OasBase
  Represents an OpenAPI reference ($ref) in the SKMTC OAS processing system.

  The `OasRef` class handles OpenAPI JSON Reference Objects that point to reusable
  components within the same document. It provides type-safe reference resolution
  with support for chained references and circular reference detection.

  ## Key Features

  - Type Safety: Generic parameter ensures resolved types match the reference type
  - Lazy Resolution: References are resolved on-demand, not during construction
  - Chain Resolution: Handles references that point to other references
  - Circular Detection: Prevents infinite loops with maximum lookup limits
  - Type Validation: Ensures resolved objects match expected reference types

  @template T
      The type of component this reference points to

  constructor(fields: RefFields<T>, context: ParseContextType)
    Creates a new OAS reference instance.

    @param fields
        Reference field data including refType and $ref

    @param document
        Discriminated document containing the referenced
        component. For OAS, refs resolve through the document's components;
        for GQL, through the document's registry (GQL only ever creates
        schema refs).

  oasType: "ref"
    OAS type identifier
  type: "ref"
    Type identifier
  isRef(): this is OasRef<T>
    Type guard to check if this instance is a reference.

    @return
        Always true for OasRef instances

  resolve(lookupsPerformed: number): ResolvedRef<T>
    Recursively resolves this reference to its final target component.

    Follows reference chains until reaching a non-reference component,
    with protection against infinite loops.

    @param lookupsPerformed
        Internal counter to prevent infinite recursion

    @return
        The resolved component

    @throws
        Error if maximum lookup depth is exceeded

  resolveOnce(): OasRef<T> | ResolvedRef<T>
    Resolves this reference one level. Dispatches on the document's
    protocol — OAS reads from `document.components.<bucket>`; GQL
    reads from `document.registry.schemas`.

    @return
        Either the resolved component or another reference in the chain

  toRefName(): RefName
  isSchemaRef(): this is OasRef<"schema">
    Narrows this reference to a schema reference.

    @return
        True when this reference points at a schema component.

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
    Navigate an {@link SchemaPath} starting from this reference, resolving it
    to descend through. See {@link traverseSchema}.

    Available on every `OasRef` so `.traverse()` works on the common
    `OasSchema | OasRef<'schema'>` value (an object property, array `items`).
    Schema paths only describe schemas for now, so it throws for non-schema
    refs (response/parameter/…); {@link isSchemaRef} narrows `this`, keeping the
    delegation cast-free.

    @return
        The schema at the path (may be an unresolved `$ref`).

    @throws
        Error when called on a non-schema ref.

  get $ref(): string
  get refType(): OasRefData["refType"]
  get nullable(): boolean | undefined
    Use-site nullability of this reference (see {@link RefFields.nullable}).
    The getter exists on the prototype, so `'nullable' in ref` is always
    true and the value-function nullable read picks it up uniformly.
  get document(): SkmtcParsedDocument
    Returns the discriminated parsed document this ref resolves
    through. OAS variant carries the parent `OasDocument`; GQL variant
    carries the parent `GqlDocument` (whose registry holds the
    schemas).
  toJsonSchema({resolve}: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>
  toJSON(): object

Defined in deno/core/oas/ref/Ref.ts:382:1

type OasComponentType = OasSchema | OasResponse | OasParameter | OasExample | OasRequestBody | OasHeader | OasSecurityScheme | OasLink
  Union type of all OAS component types that can be referenced.

  Includes all OpenAPI component types that support $ref resolution.

Defined in deno/core/oas/ref/Ref.ts:55:1

type RefFields<T extends OasRefData["refType"]> = { refType: T; $ref: string; nullable?: boolean; }
  Field data for creating OAS reference objects.

  @template T
      The type of component being referenced (e.g., 'schema', 'response')

Defined in deno/core/oas/ref/Ref.ts:397:1

type ResolvedRef<T extends OasRefData["refType"]> = Extract<OasComponentType, { oasType: T; }>
  Type representing a resolved reference to a specific component type.

  @template T
      The type of component being referenced (e.g., 'schema', 'response')

Defined in deno/core/oas/ref/Ref.ts:373:1

type ResolvedRefJsonType<T extends OasRefData["refType"]> = ReturnType<ResolvedRef<T>["toJsonSchema"]>
  Type representing the JSON schema result from resolving a reference.

  @template T
      The type of component being referenced
```
### `core/oas/discriminator/Discriminator.ts`

```text
Defined in deno/core/oas/discriminator/Discriminator.ts:5:1

class OasDiscriminator

  constructor(fields: DiscriminatorFields)
  oasType: "discriminator"
  propertyName: string
  mapping?: Record<string, string>

Defined in deno/core/oas/discriminator/Discriminator.ts:0:1

type DiscriminatorFields = { propertyName: string; mapping?: Record<string, string>; }
```
### `core/dsl/CustomValue.ts`

```text
Defined in deno/core/dsl/CustomValue.ts:97:14

function isCustomValue(value: unknown): value is CustomValue
  Type guard function to check if a value is a CustomValue instance.

  @param value
      Value to check

  @return
      True if the value is a CustomValue, false otherwise

Defined in deno/core/dsl/CustomValue.ts:30:1

class CustomValue extends SnippetBase
  Represents a custom value in the SKMTC generation pipeline.

  CustomValue allows generators to create arbitrary content that doesn't fit
  standard schema types. Used for injecting custom code, templates, or specialized
  content during the generation process.

  constructor({context, value, generatorKey}: CreateArgs)
    Creates a new CustomValue instance.

    @param args
        Creation arguments including context, value, and optional generator key

  type: "custom"
    Type identifier for this custom value
  value: Stringable
    The underlying value content that can be converted to string
  isRef(): this is OasRef<"schema">
    Determines if this custom value is a reference.

    @return
        Always false since custom values are concrete content, not references

  resolve(): CustomValue
    Resolves this custom value.

    @return
        The custom value itself since it's already resolved

  resolveOnce(): CustomValue
    Resolves this custom value one level.

    @return
        The custom value itself since it's already resolved

  override toString(): string
    Converts the custom value to its string representation.

    @return
        String representation of the underlying value

Defined in deno/core/dsl/CustomValue.ts:6:1

private type CreateArgs = { context: GenerateContextType; value: Stringable; generatorKey?: GeneratorKey; }
```
### `@skmtc/core` — the router and insertion contracts

The `SchemaToValueFn` router contract (`TypeSystemArgs` in, `TypeSystemOutput` out — structural: a per-type snippet carries its output type's fields alongside its own state), the deliberately thin `Modifiers`, and the `Inserted` handle `insertModel` / `insertOperation` return (`inserted.definition.value` IS the peer projection instance for Driver-built definitions). Note: consumers of routed values read the generator's own value fields (`annotations`, `defaultValue`) rather than narrowing `.type` — some doc-comment examples below predate that rule.

### `core/types/TypeSystem.ts`

```text
Defined in deno/core/types/TypeSystem.ts:537:1

type SchemaToNonRef<Schema extends SchemaType> = Schema extends OasRef<"schema"> ? never : Schema
  Extracts only non-reference types from a schema type.

  @template Schema
      The schema type to filter

Defined in deno/core/types/TypeSystem.ts:524:1

type SchemaToRef<Schema extends SchemaType> = Schema extends OasRef<"schema"> ? Schema : never
  Extracts only reference types from a schema type.

  @template Schema
      The schema type to filter

Defined in deno/core/types/TypeSystem.ts:450:1

type SchemaToTypeSystemMap = { ref: { source: OasRef<"schema">; output: TypeSystemRef; }; array: { source: OasSchema; output: TypeSystemArray; }; number: { source: OasSchema; output: TypeSystemNumber; }; void: { source: OasVoid; output: TypeSystemVoid; }; integer: { source: OasSchema; output: TypeSystemInteger; }; boolean: { source: OasSchema; output: TypeSystemBoolean; }; unknown: { source: OasSchema; output: TypeSystemUnknown; }; null: { source: OasSchema; output: TypeSystemNull; }; object: { source: OasSchema; output: TypeSystemObject; }; string: { source: OasSchema; output: TypeSystemString; }; union: { source: OasSchema; output: TypeSystemUnion; }; custom: { source: CustomValue; output: TypeSystemCustom; }; }
  Mapping of schema types to their type system representations.

  This type maps OpenAPI schema types to their corresponding type system
  value types, enabling type-safe transformations during code generation.

Defined in deno/core/types/TypeSystem.ts:606:1

type SchemaToValueFn = (args: TypeSystemArgs<Schema>) => TypeSystemOutput<Schema["type"]>
  Function type for transforming schemas to type system values.

  @template Schema
      The schema type being transformed

  @param args
      Transformation arguments

  @return
      The corresponding type system value

Defined in deno/core/types/TypeSystem.ts:512:1

type SchemaType = OasSchema | OasRef<"schema"> | OasVoid | CustomValue
  Union of all possible schema types that can be transformed.

Defined in deno/core/types/TypeSystem.ts:571:1

type TypeSystemArgs<Schema extends SchemaType> = { context: GenerateContextType; destinationPath: string; schema: Schema; rootRef?: RefName; required: boolean | undefined; }
  Arguments for type system transformation functions.

  @template Schema
      The specific schema type being transformed

Defined in deno/core/types/TypeSystem.ts:145:1

type TypeSystemArray = { type: "array"; items: TypeSystemValue; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of array types.

Defined in deno/core/types/TypeSystem.ts:241:1

type TypeSystemBoolean = { type: "boolean"; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of boolean types.

Defined in deno/core/types/TypeSystem.ts:124:1

type TypeSystemCustom = { type: "custom"; value: Stringable; generatorKey?: GeneratorKey; }
  Type system representation for custom, generator-specific types.

  `TypeSystemCustom` allows generators to inject custom type representations
  that don't fit into standard OpenAPI types. The value is a `Stringable`
  that will be rendered directly in the generated code.

Defined in deno/core/types/TypeSystem.ts:221:1

type TypeSystemInteger = { type: "integer"; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of integer number types.

Defined in deno/core/types/TypeSystem.ts:203:1

type TypeSystemNever = { type: "never"; generatorKey?: GeneratorKey; }
  Type system representation of never types (impossible values).

Defined in deno/core/types/TypeSystem.ts:277:1

type TypeSystemNull = { type: "null"; generatorKey?: GeneratorKey; }
  Type system representation of null types.

Defined in deno/core/types/TypeSystem.ts:167:1

type TypeSystemNumber = { type: "number"; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of floating-point number types.

Defined in deno/core/types/TypeSystem.ts:424:1

type TypeSystemObject = { type: "object"; recordProperties: TypeSystemRecord | null; objectProperties: TypeSystemObjectProperties | null; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of object types.

  Objects can have either fixed properties (objectProperties) or
  dynamic key-value pairs (recordProperties), or both.

Defined in deno/core/types/TypeSystem.ts:314:1

type TypeSystemObjectProperties = { properties: Record<string, TypeSystemValue>; generatorKey?: GeneratorKey; }
  Type system representation of object properties.

Defined in deno/core/types/TypeSystem.ts:550:1

type TypeSystemOutput<T extends keyof SchemaToTypeSystemMap> = SchemaToTypeSystemMap[T]["output"]
  Gets the output type for a given schema type key.

  @template T
      The schema type key

Defined in deno/core/types/TypeSystem.ts:294:1

type TypeSystemRecord = { value: TypeSystemValue | "true"; generatorKey?: GeneratorKey; }
  Type system representation of record types (key-value mappings).

Defined in deno/core/types/TypeSystem.ts:97:1

type TypeSystemRef = { type: "ref"; name: string; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of a reference to another schema.

  `TypeSystemRef` represents references to other schemas, typically used for
  complex types that are defined elsewhere in the schema and referenced
  through `$ref` in OpenAPI specifications.

Defined in deno/core/types/TypeSystem.ts:341:1

type TypeSystemString = { type: "string"; format: string | undefined; enums: string[] | (string | null)[] | undefined; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of string types.

Defined in deno/core/types/TypeSystem.ts:377:1

type TypeSystemUnion = { type: "union"; members: TypeSystemValue[]; discriminator: string | undefined; modifiers: Modifiers; generatorKey?: GeneratorKey; }
  Type system representation of union types.

Defined in deno/core/types/TypeSystem.ts:260:1

type TypeSystemUnknown = { type: "unknown"; generatorKey?: GeneratorKey; }
  Type system representation of unknown types.

Defined in deno/core/types/TypeSystem.ts:65:1

type TypeSystemValue = TypeSystemArray | TypeSystemObject | TypeSystemUnion | TypeSystemString | TypeSystemNumber | TypeSystemInteger | TypeSystemBoolean | TypeSystemUnknown | TypeSystemVoid | TypeSystemNever | TypeSystemRef | TypeSystemNull | TypeSystemCustom
  Union type representing all possible type system values in the SKMTC code generation system.

  The `TypeSystemValue` represents the normalized intermediate representation used by SKMTC
  to convert OpenAPI schemas into target language types. This type system abstracts away
  OpenAPI-specific details and provides a consistent interface for generating code in
  different target languages and frameworks.

  ## Type Categories

  - Primitive Types: `string`, `number`, `integer`, `boolean`, `null`
  - Complex Types: `array`, `object`, `union`
  - Special Types: `void`, `never`, `unknown`, `custom`
  - Reference Types: `ref` for schema references

Defined in deno/core/types/TypeSystem.ts:186:1

type TypeSystemVoid = { type: "void"; generatorKey?: GeneratorKey; }
  Type system representation of void types (no value).
```
### `core/types/Modifiers.ts`

```text
Defined in deno/core/types/Modifiers.ts:65:1

type Modifiers = { required?: boolean; description?: string; nullable?: boolean; }
  Type modifiers used throughout the SKMTC type system.

  `Modifiers` represent additional metadata and constraints that can be
  applied to type system values. These modifiers affect how types are
  generated and used in the target language output.
```
### `core/dsl/Inserted.ts`

```text
Defined in deno/core/dsl/Inserted.ts:67:1

class Inserted<V extends GeneratedValue, EnrichmentType>
  Represents a successfully inserted generator artifact in the SKMTC DSL system.

  The `Inserted` class is returned when generators are inserted into the generation
  context, providing access to the generated content, metadata, and configuration.
  It acts as a bridge between the insertion process and the consuming code that
  needs to reference or use the generated artifacts.

  This class provides type-safe access to generated values with proper handling
  of both forced and lazy generation modes, ensuring the correct optionality
  of the generated content based on the generation strategy used.

  ## Key Features

  - Type Safety: Generic parameters preserve exact types from generators
  - Metadata Access: Provides access to identifiers, export paths, and settings
  - Value Extraction: Type-safe value extraction with proper optionality
  - Enrichment Support: Full support for custom enrichment data types

  @template V
      The type of generated value (preserves generator output type)

  @template EnrichmentType
      Optional type for custom enrichment data

  constructor({settings, definition}: ConstructorArgs<V, EnrichmentType>)
    Creates a new Inserted instance.

    @param args
        Insertion configuration

    @param args.settings
        Content settings with identifier and export path

    @param args.definition
        The generated definition containing the value

  settings: ContentSettings<EnrichmentType>
    Content settings including identifier and export path
  definition: GeneratedDefinition<V>
    The generated definition with its value
  toName(): string
    Gets the name of the inserted artifact.

    This method returns the string name from the identifier, which is commonly
    used when referencing the generated artifact in code or templates.

    @return
        The name of the inserted artifact

  toIdentifier(): IdentifierBase
    Gets the full identifier of the inserted artifact.

    This method returns the complete `IdentifierBase` object, which carries
    the name and (language-neutrally) the type annotation. Useful when you
    need access to the type annotation or export flag.

    @return
        The complete `IdentifierBase` object

  toExportPath(): string
    Gets the export path where the artifact was generated.

    This method returns the file path where the generated artifact is located,
    which is useful for creating import statements or understanding the file
    structure of generated code.

    @return
        The export path of the generated artifact

  toValue(): V
    Gets the generated value from the inserted artifact.

    This method returns the actual generated content with proper type safety

    @return
        The generated value

Defined in deno/core/dsl/Inserted.ts:10:1

private type ConstructorArgs<V extends GeneratedValue, EnrichmentType> = { settings: ContentSettings<EnrichmentType>; definition: GeneratedDefinition<V>; }
  Constructor arguments for {@link Inserted}.

  @template V
      The type of generated value

  @template EnrichmentType
      Optional enrichment data type
```
