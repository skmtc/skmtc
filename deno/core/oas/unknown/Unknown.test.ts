import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasUnknown } from './Unknown.ts'

Deno.test('OasUnknown - constructor with no arguments creates empty unknown instance', () => {
  const unknown = new OasUnknown()

  assertEquals(unknown.type, 'unknown')
  assertEquals(unknown.oasType, 'schema')
  assertEquals(unknown.title, undefined)
  assertEquals(unknown.description, undefined)
  assertEquals(unknown.extensionFields, undefined)
  assertEquals(unknown.example, undefined)
  assertEquals(unknown.nullable, undefined)
})

Deno.test('OasUnknown - constructor with title field sets title correctly', () => {
  const unknown = new OasUnknown({
    title: 'Unknown Type'
  })

  assertEquals(unknown.title, 'Unknown Type')
  assertEquals(unknown.description, undefined)
  assertEquals(unknown.extensionFields, undefined)
  assertEquals(unknown.example, undefined)
  assertEquals(unknown.nullable, undefined)
})

Deno.test('OasUnknown - constructor with description field sets description correctly', () => {
  const unknown = new OasUnknown({
    description: 'A type that is not specified'
  })

  assertEquals(unknown.title, undefined)
  assertEquals(unknown.description, 'A type that is not specified')
  assertEquals(unknown.extensionFields, undefined)
  assertEquals(unknown.example, undefined)
  assertEquals(unknown.nullable, undefined)
})

Deno.test('OasUnknown - constructor with all fields', () => {
  const unknown = new OasUnknown({
    title: 'Unknown Type',
    description: 'A flexible type',
    extensionFields: { 'x-custom': 'value' },
    example: { data: 'example' },
    nullable: true
  })

  assertEquals(unknown.title, 'Unknown Type')
  assertEquals(unknown.description, 'A flexible type')
  assertEquals(unknown.extensionFields, { 'x-custom': 'value' })
  assertEquals(unknown.example, { data: 'example' })
  assertEquals(unknown.nullable, true)
})

Deno.test('OasUnknown - constructor with extensionFields only', () => {
  const unknown = new OasUnknown({
    extensionFields: {
      'x-internal': true,
      'x-version': '1.0'
    }
  })

  assertEquals(unknown.extensionFields, {
    'x-internal': true,
    'x-version': '1.0'
  })
  assertEquals(unknown.title, undefined)
  assertEquals(unknown.description, undefined)
})

Deno.test('OasUnknown - constructor with example field', () => {
  const unknown = new OasUnknown({
    example: 'example value'
  })

  assertEquals(unknown.example, 'example value')
})

Deno.test('OasUnknown - constructor with nullable field', () => {
  const unknown = new OasUnknown({
    nullable: true
  })

  assertEquals(unknown.nullable, true)
})

Deno.test('OasUnknown - oasType property is always "schema"', () => {
  const unknown1 = new OasUnknown()
  const unknown2 = new OasUnknown({ title: 'Test' })
  const unknown3 = new OasUnknown({ extensionFields: {} })

  assertEquals(unknown1.oasType, 'schema')
  assertEquals(unknown2.oasType, 'schema')
  assertEquals(unknown3.oasType, 'schema')
})

Deno.test('OasUnknown - type property is always "unknown"', () => {
  const unknown1 = new OasUnknown()
  const unknown2 = new OasUnknown({ description: 'Test description' })
  const unknown3 = new OasUnknown({ nullable: true })

  assertEquals(unknown1.type, 'unknown')
  assertEquals(unknown2.type, 'unknown')
  assertEquals(unknown3.type, 'unknown')
})

Deno.test('OasUnknown - isRef() always returns false', () => {
  const unknown1 = new OasUnknown()
  const unknown2 = new OasUnknown({ title: 'Test' })
  const unknown3 = new OasUnknown({ extensionFields: {} })

  assertEquals(unknown1.isRef(), false)
  assertEquals(unknown2.isRef(), false)
  assertEquals(unknown3.isRef(), false)
})

Deno.test('OasUnknown - resolve() returns itself', () => {
  const unknown = new OasUnknown({ title: 'Test' })
  const resolved = unknown.resolve()

  assertStrictEquals(resolved, unknown)
  assertEquals(resolved.title, 'Test')
})

Deno.test('OasUnknown - resolveOnce() returns itself', () => {
  const unknown = new OasUnknown({ description: 'Test description' })
  const resolved = unknown.resolveOnce()

  assertStrictEquals(resolved, unknown)
  assertEquals(resolved.description, 'Test description')
})

Deno.test('OasUnknown - toJsonSchema() with all fields returns only title, description, example', () => {
  const unknown = new OasUnknown({
    title: 'Unknown Type',
    description: 'A flexible type',
    extensionFields: { 'x-custom': 'value' },
    example: { data: 'example' },
    nullable: true
  })

  const jsonSchema = unknown.toJsonSchema()

  // Only title, description, and example are included in JSON schema
  assertEquals(jsonSchema, {
    title: 'Unknown Type',
    description: 'A flexible type',
    example: { data: 'example' }
  })

  // Verify that nullable and extensionFields are NOT included
  assertEquals((jsonSchema as any).nullable, undefined)
  assertEquals((jsonSchema as any).extensionFields, undefined)
})

Deno.test('OasUnknown - toJsonSchema() with minimal fields', () => {
  const unknown = new OasUnknown()

  const jsonSchema = unknown.toJsonSchema()

  assertEquals(jsonSchema, {
    title: undefined,
    description: undefined,
    example: undefined
  })
})

Deno.test('OasUnknown - toJsonSchema() with only example', () => {
  const unknown = new OasUnknown({
    example: 'example value'
  })

  const jsonSchema = unknown.toJsonSchema()

  assertEquals(jsonSchema, {
    title: undefined,
    description: undefined,
    example: 'example value'
  })
})

Deno.test('OasUnknown - toJsonSchema() ignores options parameter', () => {
  const unknown = new OasUnknown({
    title: 'Test',
    description: 'Description'
  })

  // Options parameter should be ignored
  const jsonSchema1 = unknown.toJsonSchema()
  const jsonSchema2 = unknown.toJsonSchema({} as any)

  assertEquals(jsonSchema1, jsonSchema2)
  assertEquals(jsonSchema1, {
    title: 'Test',
    description: 'Description',
    example: undefined
  })
})

Deno.test('OasUnknown - toJsonSchema() does NOT include nullable or extensionFields', () => {
  const unknown = new OasUnknown({
    title: 'Test',
    nullable: true,
    extensionFields: { 'x-custom': 'should not appear' }
  })

  const jsonSchema = unknown.toJsonSchema()

  // Explicitly verify these fields are not present
  assertEquals(jsonSchema.hasOwnProperty('nullable'), false)
  assertEquals(jsonSchema.hasOwnProperty('extensionFields'), false)
  assertEquals(Object.keys(jsonSchema).length, 3) // Only title, description, example
})

Deno.test('OasUnknown - example can be a string', () => {
  const unknown = new OasUnknown({
    example: 'string example'
  })

  assertEquals(unknown.example, 'string example')
  assertEquals(unknown.toJsonSchema().example, 'string example')
})

Deno.test('OasUnknown - example can be a number', () => {
  const unknown = new OasUnknown({
    example: 42
  })

  assertEquals(unknown.example, 42)
  assertEquals(unknown.toJsonSchema().example, 42)
})

Deno.test('OasUnknown - example can be an object', () => {
  const exampleObj = { name: 'test', value: 123 }
  const unknown = new OasUnknown({
    example: exampleObj
  })

  assertEquals(unknown.example, exampleObj)
  assertEquals(unknown.toJsonSchema().example, exampleObj)
})

Deno.test('OasUnknown - example can be an array', () => {
  const exampleArray = [1, 2, 3, 'four']
  const unknown = new OasUnknown({
    example: exampleArray
  })

  assertEquals(unknown.example, exampleArray)
  assertEquals(unknown.toJsonSchema().example, exampleArray)
})

Deno.test('OasUnknown - example can be null', () => {
  const unknown = new OasUnknown({
    example: null
  })

  assertEquals(unknown.example, null)
  assertEquals(unknown.toJsonSchema().example, null)
})

Deno.test('OasUnknown - example can be undefined', () => {
  const unknown = new OasUnknown({
    example: undefined
  })

  assertEquals(unknown.example, undefined)
  assertEquals(unknown.toJsonSchema().example, undefined)
})

Deno.test('OasUnknown - extensionFields can store custom properties', () => {
  const unknown = new OasUnknown({
    extensionFields: {
      'x-internal': true,
      'x-version': '2.0',
      'x-metadata': { key: 'value' }
    }
  })

  assertEquals(unknown.extensionFields, {
    'x-internal': true,
    'x-version': '2.0',
    'x-metadata': { key: 'value' }
  })
})

Deno.test('OasUnknown - extensionFields support various value types', () => {
  const unknown = new OasUnknown({
    extensionFields: {
      'x-string': 'text',
      'x-number': 42,
      'x-boolean': true,
      'x-array': [1, 2, 3],
      'x-object': { nested: 'value' },
      'x-null': null
    }
  })

  assertEquals(unknown.extensionFields?.['x-string'], 'text')
  assertEquals(unknown.extensionFields?.['x-number'], 42)
  assertEquals(unknown.extensionFields?.['x-boolean'], true)
  assertEquals(unknown.extensionFields?.['x-array'], [1, 2, 3])
  assertEquals(unknown.extensionFields?.['x-object'], { nested: 'value' })
  assertEquals(unknown.extensionFields?.['x-null'], null)
})

Deno.test('OasUnknown - extensionFields can be empty object', () => {
  const unknown = new OasUnknown({
    extensionFields: {}
  })

  assertEquals(unknown.extensionFields, {})
})

Deno.test('OasUnknown - constructor with empty object behaves same as no arguments', () => {
  const unknown1 = new OasUnknown()
  const unknown2 = new OasUnknown({})

  assertEquals(unknown1.type, unknown2.type)
  assertEquals(unknown1.oasType, unknown2.oasType)
  assertEquals(unknown1.title, unknown2.title)
  assertEquals(unknown1.description, unknown2.description)
  assertEquals(unknown1.extensionFields, unknown2.extensionFields)
  assertEquals(unknown1.example, unknown2.example)
  assertEquals(unknown1.nullable, unknown2.nullable)
})

Deno.test('OasUnknown - multiple instances are independent', () => {
  const unknown1 = new OasUnknown({ title: 'Unknown 1', example: 'example1' })
  const unknown2 = new OasUnknown({ title: 'Unknown 2', example: 'example2' })

  assertEquals(unknown1 !== unknown2, true)
  assertEquals(unknown1.title, 'Unknown 1')
  assertEquals(unknown2.title, 'Unknown 2')
  assertEquals(unknown1.example, 'example1')
  assertEquals(unknown2.example, 'example2')
})

Deno.test('OasUnknown - all optional fields can be undefined', () => {
  const unknown = new OasUnknown({
    title: undefined,
    description: undefined,
    extensionFields: undefined,
    example: undefined,
    nullable: undefined
  })

  assertEquals(unknown.title, undefined)
  assertEquals(unknown.description, undefined)
  assertEquals(unknown.extensionFields, undefined)
  assertEquals(unknown.example, undefined)
  assertEquals(unknown.nullable, undefined)
})

Deno.test('OasUnknown - nullable flag can be true, false, or undefined', () => {
  const unknownTrue = new OasUnknown({ nullable: true })
  const unknownFalse = new OasUnknown({ nullable: false })
  const unknownUndefined = new OasUnknown({ nullable: undefined })

  assertEquals(unknownTrue.nullable, true)
  assertEquals(unknownFalse.nullable, false)
  assertEquals(unknownUndefined.nullable, undefined)
})

Deno.test('OasUnknown - typical usage for unspecified schema type', () => {
  const unknown = new OasUnknown({
    title: 'Flexible Data',
    description: 'This field can accept any type of data',
    example: { any: 'data', can: 'go', here: true }
  })

  assertEquals(unknown.type, 'unknown')
  assertEquals(unknown.title, 'Flexible Data')

  const jsonSchema = unknown.toJsonSchema()
  assertEquals(jsonSchema.title, 'Flexible Data')
  assertEquals(jsonSchema.description, 'This field can accept any type of data')
})

Deno.test('OasUnknown - usage with extension fields for custom metadata', () => {
  const unknown = new OasUnknown({
    title: 'Custom Type',
    extensionFields: {
      'x-internal-id': '12345',
      'x-deprecated': true,
      'x-migration-path': 'Use NewType instead'
    }
  })

  assertEquals(unknown.extensionFields?.['x-internal-id'], '12345')
  assertEquals(unknown.extensionFields?.['x-deprecated'], true)

  // Extension fields should not appear in JSON schema
  const jsonSchema = unknown.toJsonSchema()
  assertEquals((jsonSchema as any)['x-internal-id'], undefined)
})

Deno.test('OasUnknown - example field preserves complex nested structures', () => {
  const complexExample = {
    user: {
      id: 123,
      profile: {
        name: 'John',
        tags: ['admin', 'verified']
      }
    },
    metadata: null
  }

  const unknown = new OasUnknown({
    example: complexExample
  })

  assertEquals(unknown.example, complexExample)
  assertEquals(unknown.toJsonSchema().example, complexExample)
})
