import {
  toOasOperationGeneratorKey,
  toModelGeneratorKey,
  toGeneratorOnlyKey,
  isOasOperationGeneratorKey,
  isModelGeneratorKey,
  isGeneratorKey,
  toGeneratorId,
  fromGeneratorKey
} from './GeneratorKeys.ts'
import { assertEquals } from '@std/assert/equals'
import type { RefName } from '@/types/RefName.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'

// Factory Functions Tests

Deno.test('toOasOperationGeneratorKey - creates key with path, method and variant', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users',
    method: 'get',
    variant: 'main'
  })

  assertEquals(key, 'api-client|/users|get|main')
})

Deno.test('toOasOperationGeneratorKey - encodes a non-default variant', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: 'forms',
    path: '/quotes/{id}',
    method: 'patch',
    variant: 'customer'
  })

  assertEquals(key, 'forms|/quotes/{id}|patch|customer')
})

Deno.test('toOasOperationGeneratorKey - creates key from operation object', () => {
  const operation = new OasOperation({
    path: '/products/{id}',
    method: 'post',
    pathItem: undefined,
    responses: {}
  })

  const key = toOasOperationGeneratorKey({
    generatorId: 'rest-client',
    operation,
    variant: 'main'
  })

  assertEquals(key, 'rest-client|/products/{id}|post|main')
})

Deno.test('toModelGeneratorKey - creates key with generator ID and ref name', () => {
  const key = toModelGeneratorKey({
    generatorId: 'typescript-types',
    refName: 'User' as RefName
  })

  assertEquals(key, 'typescript-types|User')
})

Deno.test('toGeneratorOnlyKey - creates key with just generator ID', () => {
  const key = toGeneratorOnlyKey({
    generatorId: 'utilities'
  })

  assertEquals(key, 'utilities')
})

// Type Guard Tests

Deno.test('isOasOperationGeneratorKey - returns true for valid operation key', () => {
  const key = 'api-client|/users/{id}|get|main'
  assertEquals(isOasOperationGeneratorKey(key), true)
})

Deno.test('isOasOperationGeneratorKey - returns false for invalid format', () => {
  // Missing variant (old 3-segment shape)
  assertEquals(isOasOperationGeneratorKey('api-client|/users|get'), false)

  // Too many parts
  assertEquals(isOasOperationGeneratorKey('api-client|/users|get|main|extra'), false)

  // Invalid method
  assertEquals(isOasOperationGeneratorKey('api-client|/users|invalid|main'), false)

  // Empty variant segment
  assertEquals(isOasOperationGeneratorKey('api-client|/users|get|'), false)

  // Non-string
  assertEquals(isOasOperationGeneratorKey(123), false)
})

Deno.test('isModelGeneratorKey - returns true for valid model key', () => {
  const key = 'zod-schemas|User'
  assertEquals(isModelGeneratorKey(key), true)
})

Deno.test('isModelGeneratorKey - returns false for invalid format', () => {
  // Too few parts
  assertEquals(isModelGeneratorKey('zod-schemas'), false)

  // Too many parts
  assertEquals(isModelGeneratorKey('zod-schemas|User|extra'), false)

  // Non-string
  assertEquals(isModelGeneratorKey(null), false)
})

Deno.test('isGeneratorKey - returns true for all valid key types', () => {
  // Operation key (4 segments including variant)
  assertEquals(isGeneratorKey('api-client|/users|get|main'), true)

  // Model key
  assertEquals(isGeneratorKey('typescript-types|User'), true)

  // Generator-only key
  assertEquals(isGeneratorKey('utilities'), true)

  // Invalid
  assertEquals(isGeneratorKey(null), false)
  assertEquals(isGeneratorKey(''), false)
})

// Parser Functions Tests

Deno.test('toGeneratorId - extracts ID from different key types', () => {
  // Operation key
  const opKey = toOasOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users',
    method: 'get',
    variant: 'main'
  })
  assertEquals(toGeneratorId(opKey), 'api-client')

  // Model key
  const modelKey = toModelGeneratorKey({
    generatorId: 'typescript-types',
    refName: 'User' as RefName
  })
  assertEquals(toGeneratorId(modelKey), 'typescript-types')

  // Generator-only key
  const genKey = toGeneratorOnlyKey({
    generatorId: 'utilities'
  })
  assertEquals(toGeneratorId(genKey), 'utilities')
})

Deno.test('fromGeneratorKey - parses operation key into object', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users/{id}',
    method: 'get',
    variant: 'main'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'oasOperation')
  if (parsed.type === 'oasOperation') {
    assertEquals(parsed.generatorId, 'api-client')
    assertEquals(parsed.path, '/users/{id}')
    assertEquals(parsed.method, 'get')
    assertEquals(parsed.variant, 'main')
  }
})

Deno.test('fromGeneratorKey - parses model key into object', () => {
  const key = toModelGeneratorKey({
    generatorId: 'zod-schemas',
    refName: 'User' as RefName
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'model')
  if (parsed.type === 'model') {
    assertEquals(parsed.generatorId, 'zod-schemas')
    assertEquals(parsed.refName, 'User')
  }
})

Deno.test('fromGeneratorKey - parses generator-only key into object', () => {
  const key = toGeneratorOnlyKey({
    generatorId: 'utilities'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'generator-only')
  if (parsed.type === 'generator-only') {
    assertEquals(parsed.generatorId, 'utilities')
  }
})
