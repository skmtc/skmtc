import { assertEquals } from '@std/assert/equals'
import { isSchemaSubset } from './schemaSubset.ts'

const stringSchema = {
  type: 'string' as const
}

const integerSchema = {
  type: 'integer' as const
}

const numberSchema = {
  type: 'number' as const
}

const booleanSchema = {
  type: 'boolean' as const
}

const stringArraySchema = {
  type: 'array' as const,
  items: stringSchema
}

const integerArraySchema = {
  type: 'array' as const,
  items: integerSchema
}

const stringObjectSchema = {
  type: 'object' as const,
  properties: {
    name: stringSchema
  }
}

const stringNumberObjectSchema = {
  type: 'object' as const,
  properties: {
    name: stringSchema,
    age: numberSchema
  }
}

const requiredStringObjectSchema = {
  type: 'object' as const,
  properties: {
    name: stringSchema
  },
  required: ['name']
}

Deno.test('Detects number is not a subset of string', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringSchema,
    childSchema: numberSchema,
    topSchema: stringSchema
  })

  assertEquals(isSubset, false)
})

Deno.test('Detects string is a subset of string', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringSchema,
    childSchema: stringSchema,
    topSchema: stringSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects boolean is a subset of boolean', () => {
  const isSubset = isSchemaSubset({
    parentSchema: booleanSchema,
    childSchema: booleanSchema,
    topSchema: booleanSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects integer is a subset of number', () => {
  const isSubset = isSchemaSubset({
    parentSchema: numberSchema,
    childSchema: integerSchema,
    topSchema: numberSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects string array is a subset of string array', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringArraySchema,
    childSchema: stringArraySchema,
    topSchema: stringArraySchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects string array is not a subset of integer array', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringArraySchema,
    childSchema: integerArraySchema,
    topSchema: stringArraySchema
  })

  assertEquals(isSubset, false)
})

Deno.test('Detects string object is a subset of string object', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringObjectSchema,
    childSchema: stringObjectSchema,
    topSchema: stringObjectSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects required string object is a subset of string object', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringObjectSchema,
    childSchema: requiredStringObjectSchema,
    topSchema: stringObjectSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects required string object is not a subset of string object', () => {
  const isSubset = isSchemaSubset({
    parentSchema: requiredStringObjectSchema,
    childSchema: stringObjectSchema,
    topSchema: requiredStringObjectSchema
  })

  assertEquals(isSubset, false)
})

Deno.test('Detects string number object is a subset of string number object', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringObjectSchema,
    childSchema: stringNumberObjectSchema,
    topSchema: stringObjectSchema
  })

  assertEquals(isSubset, true)
})

Deno.test('Detects string number object is a subset of string object', () => {
  const isSubset = isSchemaSubset({
    parentSchema: stringNumberObjectSchema,
    childSchema: stringObjectSchema,
    topSchema: stringNumberObjectSchema
  })

  assertEquals(isSubset, true)
})
