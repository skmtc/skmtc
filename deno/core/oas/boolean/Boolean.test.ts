import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasBoolean } from './Boolean.ts'

Deno.test('OasBoolean - constructor with no arguments (default values)', () => {
  const bool = new OasBoolean()

  assertEquals(bool.oasType, 'schema')
  assertEquals(bool.type, 'boolean')
  assertEquals(bool.title, undefined)
  assertEquals(bool.description, undefined)
  assertEquals(bool.nullable, undefined)
  assertEquals(bool.extensionFields, undefined)
  assertEquals(bool.example, undefined)
  assertEquals(bool.enums, undefined)
  assertEquals(bool.default, undefined)
  assertEquals(bool.readOnly, undefined)
  assertEquals(bool.writeOnly, undefined)
  assertEquals(bool.deprecated, undefined)
})

Deno.test('OasBoolean - constructor with title and description', () => {
  const bool = new OasBoolean({
    title: 'Active Flag',
    description: 'Indicates whether the item is active'
  })

  assertEquals(bool.title, 'Active Flag')
  assertEquals(bool.description, 'Indicates whether the item is active')
  assertEquals(bool.type, 'boolean')
})

Deno.test('OasBoolean - constructor with nullable=true', () => {
  const bool = new OasBoolean<true>({
    nullable: true,
    example: null,
    default: null,
    enums: [true, false, null]
  })

  assertEquals(bool.nullable, true)
  assertEquals(bool.example, null)
  assertEquals(bool.default, null)
  assertEquals(bool.enums, [true, false, null])
})

Deno.test('OasBoolean - constructor with nullable=false', () => {
  const bool = new OasBoolean<false>({
    nullable: false,
    example: true,
    default: false
  })

  assertEquals(bool.nullable, false)
  assertEquals(bool.example, true)
  assertEquals(bool.default, false)
})

Deno.test('OasBoolean - constructor with example', () => {
  const boolTrue = new OasBoolean({ example: true })
  const boolFalse = new OasBoolean({ example: false })

  assertEquals(boolTrue.example, true)
  assertEquals(boolFalse.example, false)
})

Deno.test('OasBoolean - constructor with enums', () => {
  const bool = new OasBoolean({
    enums: [true, false]
  })

  assertEquals(bool.enums, [true, false])
})

Deno.test('OasBoolean - constructor with default value', () => {
  const boolTrue = new OasBoolean({ default: true })
  const boolFalse = new OasBoolean({ default: false })

  assertEquals(boolTrue.default, true)
  assertEquals(boolFalse.default, false)
})

Deno.test('OasBoolean - constructor with all fields', () => {
  const bool = new OasBoolean({
    title: 'Enabled',
    description: 'Feature enabled flag',
    nullable: false,
    example: true,
    enums: [true, false],
    default: false,
    readOnly: true,
    writeOnly: false,
    deprecated: true,
    extensionFields: { 'x-custom': 'value' }
  })

  assertEquals(bool.title, 'Enabled')
  assertEquals(bool.description, 'Feature enabled flag')
  assertEquals(bool.nullable, false)
  assertEquals(bool.example, true)
  assertEquals(bool.enums, [true, false])
  assertEquals(bool.default, false)
  assertEquals(bool.readOnly, true)
  assertEquals(bool.writeOnly, false)
  assertEquals(bool.deprecated, true)
  assertEquals(bool.extensionFields, { 'x-custom': 'value' })
})

Deno.test('OasBoolean - oasType property is always "schema"', () => {
  const bool1 = new OasBoolean()
  const bool2 = new OasBoolean({ title: 'Test' })
  const bool3 = new OasBoolean({ nullable: true })

  assertEquals(bool1.oasType, 'schema')
  assertEquals(bool2.oasType, 'schema')
  assertEquals(bool3.oasType, 'schema')
})

Deno.test('OasBoolean - type property is always "boolean"', () => {
  const bool1 = new OasBoolean()
  const bool2 = new OasBoolean({ example: true })
  const bool3 = new OasBoolean({ enums: [true, false] })

  assertEquals(bool1.type, 'boolean')
  assertEquals(bool2.type, 'boolean')
  assertEquals(bool3.type, 'boolean')
})

Deno.test('OasBoolean - isRef() always returns false', () => {
  const bool1 = new OasBoolean()
  const bool2 = new OasBoolean({ title: 'Test' })
  const bool3 = new OasBoolean({ nullable: true })

  assertEquals(bool1.isRef(), false)
  assertEquals(bool2.isRef(), false)
  assertEquals(bool3.isRef(), false)
})

Deno.test('OasBoolean - resolve() returns itself', () => {
  const bool = new OasBoolean({
    title: 'Active',
    example: true
  })
  const resolved = bool.resolve()

  assertStrictEquals(resolved, bool)
  assertEquals(resolved.title, 'Active')
  assertEquals(resolved.example, true)
})

Deno.test('OasBoolean - resolveOnce() returns itself', () => {
  const bool = new OasBoolean({
    description: 'Flag',
    default: false
  })
  const resolved = bool.resolveOnce()

  assertStrictEquals(resolved, bool)
  assertEquals(resolved.description, 'Flag')
  assertEquals(resolved.default, false)
})

Deno.test('OasBoolean - toJsonSchema() with minimal fields', () => {
  const bool = new OasBoolean()

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'boolean',
    title: undefined,
    description: undefined,
    nullable: undefined,
    example: undefined,
    enum: undefined,
    default: undefined,
    readOnly: undefined,
    writeOnly: undefined,
    deprecated: undefined
  })
})

Deno.test('OasBoolean - toJsonSchema() with title and description', () => {
  const bool = new OasBoolean({
    title: 'Active',
    description: 'Is active'
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.title, 'Active')
  assertEquals(jsonSchema.description, 'Is active')
})

Deno.test('OasBoolean - toJsonSchema() with nullable=true', () => {
  const bool = new OasBoolean<true>({
    nullable: true
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.nullable, true)
})

Deno.test('OasBoolean - toJsonSchema() with example value', () => {
  const bool = new OasBoolean({
    example: true
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.example, true)
})

Deno.test('OasBoolean - toJsonSchema() with enums', () => {
  const bool = new OasBoolean({
    enums: [true, false]
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.enum, [true, false])
})

Deno.test('OasBoolean - toJsonSchema() with default value', () => {
  const bool = new OasBoolean({
    default: false
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.default, false)
})

Deno.test('OasBoolean - toJsonSchema() with readOnly, writeOnly, deprecated', () => {
  const bool = new OasBoolean({
    readOnly: true,
    writeOnly: false,
    deprecated: true
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.type, 'boolean')
  assertEquals(jsonSchema.readOnly, true)
  assertEquals(jsonSchema.writeOnly, false)
  assertEquals(jsonSchema.deprecated, true)
})

Deno.test('OasBoolean - toJsonSchema() excludes extensionFields', () => {
  const bool = new OasBoolean({
    extensionFields: {
      'x-custom': 'value',
      'x-internal': true
    }
  })

  const jsonSchema = bool.toJsonSchema()

  assertEquals(jsonSchema.hasOwnProperty('extensionFields'), false)
  assertEquals((jsonSchema as any)['x-custom'], undefined)
  assertEquals((jsonSchema as any)['x-internal'], undefined)
})

Deno.test('OasBoolean - example can be true', () => {
  const bool = new OasBoolean({
    example: true
  })

  assertEquals(bool.example, true)
  assertEquals(bool.toJsonSchema().example, true)
})

Deno.test('OasBoolean - example can be false', () => {
  const bool = new OasBoolean({
    example: false
  })

  assertEquals(bool.example, false)
  assertEquals(bool.toJsonSchema().example, false)
})

Deno.test('OasBoolean - example can be undefined', () => {
  const bool = new OasBoolean({
    example: undefined
  })

  assertEquals(bool.example, undefined)
  assertEquals(bool.toJsonSchema().example, undefined)
})

Deno.test('OasBoolean - example can be null when nullable=true', () => {
  const bool = new OasBoolean<true>({
    nullable: true,
    example: null
  })

  assertEquals(bool.example, null)
  assertEquals(bool.toJsonSchema().example, null)
})

Deno.test('OasBoolean - enums with [true, false] values', () => {
  const bool = new OasBoolean({
    enums: [true, false]
  })

  assertEquals(bool.enums, [true, false])
  assertEquals(bool.toJsonSchema().enum, [true, false])
})

Deno.test('OasBoolean - enums with [true, false, null] when nullable=true', () => {
  const bool = new OasBoolean<true>({
    nullable: true,
    enums: [true, false, null]
  })

  assertEquals(bool.enums, [true, false, null])
  assertEquals(bool.toJsonSchema().enum, [true, false, null])
})

Deno.test('OasBoolean - default value can be true', () => {
  const bool = new OasBoolean({
    default: true
  })

  assertEquals(bool.default, true)
  assertEquals(bool.toJsonSchema().default, true)
})

Deno.test('OasBoolean - default value can be false', () => {
  const bool = new OasBoolean({
    default: false
  })

  assertEquals(bool.default, false)
  assertEquals(bool.toJsonSchema().default, false)
})

Deno.test('OasBoolean - default value can be undefined', () => {
  const bool = new OasBoolean()

  assertEquals(bool.default, undefined)
  assertEquals(bool.toJsonSchema().default, undefined)
})

Deno.test('OasBoolean - default value can be null when nullable=true', () => {
  const bool = new OasBoolean<true>({
    nullable: true,
    default: null
  })

  assertEquals(bool.default, null)
  assertEquals(bool.toJsonSchema().default, null)
})

Deno.test('OasBoolean - empty enums array', () => {
  const bool = new OasBoolean({
    enums: []
  })

  assertEquals(bool.enums, [])
  assertEquals(bool.toJsonSchema().enum, [])
})

Deno.test('OasBoolean - empty extensionFields object', () => {
  const bool = new OasBoolean({
    extensionFields: {}
  })

  assertEquals(bool.extensionFields, {})
})

Deno.test('OasBoolean - multiple instances are independent', () => {
  const bool1 = new OasBoolean({
    title: 'Boolean 1',
    example: true
  })
  const bool2 = new OasBoolean({
    title: 'Boolean 2',
    example: false
  })

  assertEquals(bool1 !== bool2, true)
  assertEquals(bool1.title, 'Boolean 1')
  assertEquals(bool2.title, 'Boolean 2')
  assertEquals(bool1.example, true)
  assertEquals(bool2.example, false)
})

Deno.test('OasBoolean - readOnly and writeOnly can both be set', () => {
  const bool = new OasBoolean({
    readOnly: true,
    writeOnly: true
  })

  assertEquals(bool.readOnly, true)
  assertEquals(bool.writeOnly, true)
})

Deno.test('OasBoolean - extensionFields stores custom properties', () => {
  const bool = new OasBoolean({
    extensionFields: {
      'x-internal': true,
      'x-custom-field': 'custom value',
      'x-metadata': { key: 'value' }
    }
  })

  assertEquals(bool.extensionFields, {
    'x-internal': true,
    'x-custom-field': 'custom value',
    'x-metadata': { key: 'value' }
  })
})

Deno.test('OasBoolean - extensionFields supports various value types', () => {
  const bool = new OasBoolean({
    extensionFields: {
      'x-string': 'text',
      'x-number': 42,
      'x-boolean': true,
      'x-array': [1, 2, 3],
      'x-object': { nested: 'value' },
      'x-null': null
    }
  })

  assertEquals(bool.extensionFields?.['x-string'], 'text')
  assertEquals(bool.extensionFields?.['x-number'], 42)
  assertEquals(bool.extensionFields?.['x-boolean'], true)
  assertEquals(bool.extensionFields?.['x-array'], [1, 2, 3])
  assertEquals(bool.extensionFields?.['x-object'], { nested: 'value' })
  assertEquals(bool.extensionFields?.['x-null'], null)
})

Deno.test('OasBoolean - nullable=true allows null in example, default, enums', () => {
  const bool = new OasBoolean<true>({
    nullable: true,
    example: null,
    default: null,
    enums: [true, false, null]
  })

  assertEquals(bool.nullable, true)
  assertEquals(bool.example, null)
  assertEquals(bool.default, null)
  assertEquals(bool.enums, [true, false, null])

  const jsonSchema = bool.toJsonSchema()
  assertEquals(jsonSchema.nullable, true)
  assertEquals(jsonSchema.example, null)
  assertEquals(jsonSchema.default, null)
  assertEquals(jsonSchema.enum, [true, false, null])
})

Deno.test('OasBoolean - nullable=false does not allow null', () => {
  const bool = new OasBoolean<false>({
    nullable: false,
    example: true,
    default: false,
    enums: [true, false]
  })

  assertEquals(bool.nullable, false)
  assertEquals(bool.example, true)
  assertEquals(bool.default, false)
  assertEquals(bool.enums, [true, false])
})

Deno.test('OasBoolean - type narrowing works correctly with nullable parameter', () => {
  const nullableBool = new OasBoolean<true>({
    nullable: true
  })
  const nonNullableBool = new OasBoolean<false>({
    nullable: false
  })

  assertEquals(nullableBool.type, 'boolean')
  assertEquals(nonNullableBool.type, 'boolean')
  assertEquals(nullableBool.nullable, true)
  assertEquals(nonNullableBool.nullable, false)
})
