import {
  toOasOperationGeneratorKey,
  toWebhookGeneratorKey,
  toGqlOperationGeneratorKey,
  toModelGeneratorKey,
  toGeneratorOnlyKey,
  isOasOperationGeneratorKey,
  isWebhookGeneratorKey,
  isModelGeneratorKey,
  isGeneratorKey,
  toGeneratorId,
  fromGeneratorKey
} from './GeneratorKeys.ts'
import { assertEquals } from '@std/assert/equals'
import type { RefName } from '@/types/RefName.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasWebhook } from '@/oas/webhook/Webhook.ts'

// Webhook generator key tests

Deno.test('toWebhookGeneratorKey - creates key with name, method and variant', () => {
  const key = toWebhookGeneratorKey({
    generatorId: 'webhook-handlers',
    name: 'newPet',
    method: 'post',
    variant: 'main'
  })

  assertEquals(key, 'webhook-handlers|webhook|newPet|post|main')
})

Deno.test('toWebhookGeneratorKey - extracts name and method from an OasWebhook', () => {
  const webhook = new OasWebhook({
    name: 'newPet',
    method: 'post',
    pathItem: undefined,
    responses: {}
  })

  const key = toWebhookGeneratorKey({
    generatorId: 'webhook-handlers',
    webhook,
    variant: 'main'
  })

  assertEquals(key, 'webhook-handlers|webhook|newPet|post|main')
})

Deno.test('fromGeneratorKey - parses webhook key into object', () => {
  const key = toWebhookGeneratorKey({
    generatorId: 'webhook-handlers',
    name: 'newPet',
    method: 'post',
    variant: 'main'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed, {
    type: 'webhook',
    generatorId: 'webhook-handlers',
    name: 'newPet',
    method: 'post',
    variant: 'main'
  })
})

Deno.test('Webhook key is collision-free vs a same-named operation path', () => {
  // A webhook named `users` and a path `/users` must produce distinct,
  // non-overlapping keys — the literal `webhook` segment + 5-segment shape
  // keeps them disjoint so they can never share a (name, exportPath) cache
  // slot or be mistaken for one another.
  const webhookKey = toWebhookGeneratorKey({
    generatorId: 'gen',
    name: 'users',
    method: 'get',
    variant: 'main'
  })
  const operationKey = toOasOperationGeneratorKey({
    generatorId: 'gen',
    path: '/users',
    method: 'get',
    variant: 'main'
  })

  // distinct strings
  assertEquals(webhookKey === (operationKey as string), false)

  // each guard accepts only its own kind
  assertEquals(isWebhookGeneratorKey(webhookKey), true)
  assertEquals(isOasOperationGeneratorKey(webhookKey), false)
  assertEquals(isOasOperationGeneratorKey(operationKey), true)
  assertEquals(isWebhookGeneratorKey(operationKey), false)

  // both are valid generator keys, and the generator id round-trips
  assertEquals(isGeneratorKey(webhookKey), true)
  assertEquals(toGeneratorId(webhookKey), 'gen')
})

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

Deno.test('toModelGeneratorKey - creates key with generator ID, ref name, and variant', () => {
  const key = toModelGeneratorKey({
    generatorId: 'typescript-types',
    refName: 'User' as RefName,
    variant: 'main'
  })

  assertEquals(key, 'typescript-types|User|main')
})

Deno.test('toModelGeneratorKey - encodes a non-default variant', () => {
  const key = toModelGeneratorKey({
    generatorId: 'zod-schemas',
    refName: 'Customer' as RefName,
    variant: 'coercive'
  })

  assertEquals(key, 'zod-schemas|Customer|coercive')
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
  const key = 'zod-schemas|User|main'
  assertEquals(isModelGeneratorKey(key), true)
})

Deno.test('isModelGeneratorKey - returns false for invalid format', () => {
  // Missing variant (old 2-segment shape)
  assertEquals(isModelGeneratorKey('zod-schemas|User'), false)

  // Too few parts
  assertEquals(isModelGeneratorKey('zod-schemas'), false)

  // Too many parts
  assertEquals(isModelGeneratorKey('zod-schemas|User|main|extra'), false)

  // Empty variant segment
  assertEquals(isModelGeneratorKey('zod-schemas|User|'), false)

  // Non-string
  assertEquals(isModelGeneratorKey(null), false)
})

Deno.test('isGeneratorKey - returns true for all valid key types', () => {
  // Operation key (4 segments including variant)
  assertEquals(isGeneratorKey('api-client|/users|get|main'), true)

  // Model key (3 segments including variant)
  assertEquals(isGeneratorKey('typescript-types|User|main'), true)

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
    refName: 'User' as RefName,
    variant: 'main'
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
    refName: 'User' as RefName,
    variant: 'main'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'model')
  if (parsed.type === 'model') {
    assertEquals(parsed.generatorId, 'zod-schemas')
    assertEquals(parsed.refName, 'User')
    assertEquals(parsed.variant, 'main')
  }
})

Deno.test('GeneratorKey round-trip - model variant survives serialize → parse', () => {
  const key = toModelGeneratorKey({
    generatorId: '@skmtc/gen-zod-variants',
    refName: 'Customer' as RefName,
    variant: 'coercive'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'model')
  if (parsed.type === 'model') {
    assertEquals(parsed.generatorId, '@skmtc/gen-zod-variants')
    assertEquals(parsed.refName, 'Customer')
    assertEquals(parsed.variant, 'coercive')
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

// Round-trip tests pin the serialize/parse contract on the variant
// segment of the GeneratorKey. The 4-segment format
// `generatorId|path|method|variant` (OAS) and
// `generatorId|rootKind|fieldName|variant` (GQL) is load-bearing for
// the Driver's affirmDefinition integrity check: a variants-aware
// Projection that forgets to vary toIdentifier produces a collision
// only because the generatorKey threads variant through. If the
// serialize/parse pair desyncs, that integrity check silently passes
// and consumers get a corrupt file with two `export const Foo`.

Deno.test('GeneratorKey round-trip - OAS variant survives serialize → parse', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: '@skmtc/gen-shadcn-form',
    path: '/quotes/{id}',
    method: 'patch',
    variant: 'customer'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'oasOperation')
  if (parsed.type === 'oasOperation') {
    assertEquals(parsed.generatorId, '@skmtc/gen-shadcn-form')
    assertEquals(parsed.path, '/quotes/{id}')
    assertEquals(parsed.method, 'patch')
    assertEquals(parsed.variant, 'customer')
  }
})

Deno.test('GeneratorKey round-trip - OAS main variant is preserved (not stripped)', () => {
  // Even the canonical 'main' variant survives the round-trip — it is
  // not implicit, it is in the wire format.
  const key = toOasOperationGeneratorKey({
    generatorId: '@skmtc/gen-typescript',
    path: '/users',
    method: 'get',
    variant: 'main'
  })

  const parsed = fromGeneratorKey(key)
  if (parsed.type === 'oasOperation') {
    assertEquals(parsed.variant, 'main')
  }
})

Deno.test('GeneratorKey round-trip - OAS kebab-case variant survives serialize → parse', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: '@skmtc/gen-shadcn-form',
    path: '/quotes/{id}',
    method: 'patch',
    variant: 'line-items'
  })

  const parsed = fromGeneratorKey(key)
  if (parsed.type === 'oasOperation') {
    assertEquals(parsed.variant, 'line-items')
  }
})

Deno.test('GeneratorKey round-trip - GQL variant survives serialize → parse', () => {
  const key = toGqlOperationGeneratorKey({
    generatorId: '@skmtc/gen-reapit-form',
    rootKind: 'mutation',
    fieldName: 'updateContact',
    variant: 'description'
  })

  const parsed = fromGeneratorKey(key)

  assertEquals(parsed.type, 'gqlOperation')
  if (parsed.type === 'gqlOperation') {
    assertEquals(parsed.generatorId, '@skmtc/gen-reapit-form')
    assertEquals(parsed.rootKind, 'mutation')
    assertEquals(parsed.fieldName, 'updateContact')
    assertEquals(parsed.variant, 'description')
  }
})
