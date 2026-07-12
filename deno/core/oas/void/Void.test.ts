import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasVoid } from './Void.ts'

Deno.test('OasVoid - constructor with no arguments creates empty void instance', () => {
  const voidSchema = new OasVoid()

  assertEquals(voidSchema.type, 'void')
  assertEquals(voidSchema.oasType, 'schema')
  assertEquals(voidSchema.title, undefined)
  assertEquals(voidSchema.description, undefined)
})

Deno.test('OasVoid - constructor with title field sets title correctly', () => {
  const voidSchema = new OasVoid({
    title: 'No Content'
  })

  assertEquals(voidSchema.title, 'No Content')
  assertEquals(voidSchema.description, undefined)
})

Deno.test('OasVoid - constructor with description field sets description correctly', () => {
  const voidSchema = new OasVoid({
    description: 'Operation completed successfully with no response body'
  })

  assertEquals(voidSchema.title, undefined)
  assertEquals(voidSchema.description, 'Operation completed successfully with no response body')
})

Deno.test('OasVoid - constructor with both title and description sets both fields', () => {
  const voidSchema = new OasVoid({
    title: 'Deletion Successful',
    description: 'Resource was successfully deleted'
  })

  assertEquals(voidSchema.title, 'Deletion Successful')
  assertEquals(voidSchema.description, 'Resource was successfully deleted')
})

Deno.test('OasVoid - empty() static method creates OasVoid instance', () => {
  const voidSchema = OasVoid.empty()

  assertEquals(voidSchema instanceof OasVoid, true)
  assertEquals(voidSchema.type, 'void')
  assertEquals(voidSchema.oasType, 'schema')
})

Deno.test('OasVoid - empty() returns instance with undefined title and description', () => {
  const voidSchema = OasVoid.empty()

  assertEquals(voidSchema.title, undefined)
  assertEquals(voidSchema.description, undefined)
})

Deno.test('OasVoid - oasType property is always "schema"', () => {
  const voidSchema1 = new OasVoid()
  const voidSchema2 = new OasVoid({ title: 'Test' })
  const voidSchema3 = OasVoid.empty()

  assertEquals(voidSchema1.oasType, 'schema')
  assertEquals(voidSchema2.oasType, 'schema')
  assertEquals(voidSchema3.oasType, 'schema')
})

Deno.test('OasVoid - type property is always "void"', () => {
  const voidSchema1 = new OasVoid()
  const voidSchema2 = new OasVoid({ description: 'Test description' })
  const voidSchema3 = OasVoid.empty()

  assertEquals(voidSchema1.type, 'void')
  assertEquals(voidSchema2.type, 'void')
  assertEquals(voidSchema3.type, 'void')
})

Deno.test('OasVoid - isRef() always returns false', () => {
  const voidSchema1 = new OasVoid()
  const voidSchema2 = new OasVoid({ title: 'No Content' })
  const voidSchema3 = OasVoid.empty()

  assertEquals(voidSchema1.isRef(), false)
  assertEquals(voidSchema2.isRef(), false)
  assertEquals(voidSchema3.isRef(), false)
})

Deno.test('OasVoid - resolve() returns itself', () => {
  const voidSchema = new OasVoid({ title: 'Test' })
  const resolved = voidSchema.resolve()

  // Should return the same instance
  assertStrictEquals(resolved, voidSchema)
  assertEquals(resolved.title, 'Test')
})

Deno.test('OasVoid - resolveOnce() returns itself', () => {
  const voidSchema = new OasVoid({ description: 'Test description' })
  const resolved = voidSchema.resolveOnce()

  // Should return the same instance
  assertStrictEquals(resolved, voidSchema)
  assertEquals(resolved.description, 'Test description')
})

Deno.test('OasVoid - constructor with empty object behaves same as no arguments', () => {
  const voidSchema1 = new OasVoid()
  const voidSchema2 = new OasVoid({})

  assertEquals(voidSchema1.type, voidSchema2.type)
  assertEquals(voidSchema1.oasType, voidSchema2.oasType)
  assertEquals(voidSchema1.title, voidSchema2.title)
  assertEquals(voidSchema1.description, voidSchema2.description)
})

Deno.test('OasVoid - title and description can be set to empty strings', () => {
  const voidSchema = new OasVoid({
    title: '',
    description: ''
  })

  assertEquals(voidSchema.title, '')
  assertEquals(voidSchema.description, '')
})

Deno.test('OasVoid - multiple instances are independent', () => {
  const voidSchema1 = new OasVoid({ title: 'Schema 1' })
  const voidSchema2 = new OasVoid({ title: 'Schema 2' })

  // Instances should be different
  assertEquals(voidSchema1 !== voidSchema2, true)

  // Changing one shouldn't affect the other
  assertEquals(voidSchema1.title, 'Schema 1')
  assertEquals(voidSchema2.title, 'Schema 2')

  // Even if we modify one (if it were mutable), they should remain independent
  assertEquals(voidSchema1.type, 'void')
  assertEquals(voidSchema2.type, 'void')
})

Deno.test('OasVoid - typical usage for HTTP 204 No Content response', () => {
  const noContentResponse = new OasVoid({
    title: 'No Content',
    description: 'Operation completed successfully with no response body'
  })

  assertEquals(noContentResponse.type, 'void')
  assertEquals(noContentResponse.title, 'No Content')
  assertEquals(
    noContentResponse.description,
    'Operation completed successfully with no response body'
  )
  assertEquals(noContentResponse.isRef(), false)
})

Deno.test('OasVoid - typical usage as schema fallback', () => {
  // Simulating a function that returns void when schema is missing
  function processOptionalSchema(schema: unknown): OasVoid {
    if (!schema) {
      return OasVoid.empty()
    }
    return OasVoid.empty() // simplified for test
  }

  const fallbackSchema = processOptionalSchema(undefined)

  assertEquals(fallbackSchema instanceof OasVoid, true)
  assertEquals(fallbackSchema.type, 'void')
  assertEquals(fallbackSchema.title, undefined)
  assertEquals(fallbackSchema.description, undefined)
})

Deno.test('OasVoid - factory method is equivalent to constructor with empty object', () => {
  const voidFromEmpty = OasVoid.empty()
  const voidFromConstructor = new OasVoid({})

  // Both should have the same properties
  assertEquals(voidFromEmpty.type, voidFromConstructor.type)
  assertEquals(voidFromEmpty.oasType, voidFromConstructor.oasType)
  assertEquals(voidFromEmpty.title, voidFromConstructor.title)
  assertEquals(voidFromEmpty.description, voidFromConstructor.description)
  assertEquals(voidFromEmpty.isRef(), voidFromConstructor.isRef())
})
