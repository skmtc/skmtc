import {
  toOperationGeneratorKey,
  toModelGeneratorKey,
  toGeneratorOnlyKey,
  isOperationGeneratorKey,
  isModelGeneratorKey,
  isGeneratorKey,
  toGeneratorId,
  fromGeneratorKey
} from './GeneratorKeys.ts'
import { assertEquals } from '@std/assert/equals'
import type { RefName } from '@/types/RefName.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'

// Factory Functions Tests

Deno.test('toOperationGeneratorKey - creates key with path and method', () => {
  const key = toOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users',
    method: 'get'
  })

  assertEquals(key, 'api-client|/users|get')
})

Deno.test('toOperationGeneratorKey - creates key from operation object', () => {
  const operation = new OasOperation({
    path: '/products/{id}',
    method: 'post',
    pathItem: undefined,
    responses: {}
  })

  const key = toOperationGeneratorKey({
    generatorId: 'rest-client',
    operation
  })

  assertEquals(key, 'rest-client|/products/{id}|post')
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

Deno.test('isOperationGeneratorKey - returns true for valid operation key', () => {
  const key = 'api-client|/users/{id}|get'
  assertEquals(isOperationGeneratorKey(key), true)
})

Deno.test('isOperationGeneratorKey - returns false for invalid format', () => {
  // Missing method
  assertEquals(isOperationGeneratorKey('api-client|/users'), false)

  // Too many parts
  assertEquals(isOperationGeneratorKey('api-client|/users|get|extra'), false)

  // Invalid method
  assertEquals(isOperationGeneratorKey('api-client|/users|invalid'), false)

  // Non-string
  assertEquals(isOperationGeneratorKey(123), false)
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
  // Operation key
  assertEquals(isGeneratorKey('api-client|/users|get'), true)

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
  const opKey = toOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users',
    method: 'get'
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
  const key = toOperationGeneratorKey({
    generatorId: 'api-client',
    path: '/users/{id}',
    method: 'get'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'operation')
  if (parsed.type === 'operation') {
    assertEquals(parsed.generatorId, 'api-client')
    assertEquals(parsed.path, '/users/{id}')
    assertEquals(parsed.method, 'get')
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
