import { assertEquals } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { MockDefinition } from '@/test/MockFile.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import {
  toOasOperationGeneratorKey,
  toGqlOperationGeneratorKey,
  toModelGeneratorKey,
  toGeneratorOnlyKey
} from '@/dsl/GeneratorKeys.ts'
import { attribute } from './attribute.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'

const stubContext = (): GenerateContextType =>
  ({}) as unknown as GenerateContextType

class TestProducer extends SnippetBase {
  constructor(generatorKey?: GeneratorKey, stackTrail?: StackTrail) {
    super({ context: stubContext(), generatorKey, stackTrail })
  }

  override toString(): string {
    return ''
  }
}

Deno.test('attribute - OAS operation key produces #/paths/<path>/<method>', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: '@scope/gen-ts',
    path: '/users/{id}',
    method: 'get',
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.generatorId, '@scope/gen-ts')
  assertEquals(attr.schemaPointer, '#/paths/~1users~1{id}/get')
  assertEquals(attr.variant, 'main')
  assertEquals(attr.definitionName, undefined)
})

Deno.test('attribute - OAS operation with non-main variant', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: '@scope/gen-form',
    path: '/quotes',
    method: 'patch',
    variant: 'customer'
  })
  const attr = attribute(new TestProducer(key))
  assertEquals(attr.variant, 'customer')
})

Deno.test('attribute - GQL operation key produces <rootKind>.<fieldName>', () => {
  const key = toGqlOperationGeneratorKey({
    generatorId: '@scope/gen-gql',
    rootKind: 'query',
    fieldName: 'getUser',
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.generatorId, '@scope/gen-gql')
  assertEquals(attr.schemaPointer, 'query.getUser')
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - Model key produces #/components/schemas/<refName>', () => {
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName,
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.generatorId, '@scope/gen-zod')
  assertEquals(attr.schemaPointer, '#/components/schemas/User')
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - Model key threads non-default variant', () => {
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod-variants',
    refName: 'Customer' as RefName,
    variant: 'coercive'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.generatorId, '@scope/gen-zod-variants')
  assertEquals(attr.schemaPointer, '#/components/schemas/Customer')
  assertEquals(attr.variant, 'coercive')
})

Deno.test('attribute - generator-only key yields empty srcPtr', () => {
  const key = toGeneratorOnlyKey({ generatorId: '@scope/gen-utils' })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.generatorId, '@scope/gen-utils')
  assertEquals(attr.schemaPointer, '')
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - producer with no generatorKey returns <unknown>', () => {
  const attr = attribute(new TestProducer(undefined))

  assertEquals(attr.generatorId, '<unknown>')
  assertEquals(attr.schemaPointer, '')
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - explicit srcPtr field overrides key-derived pointer', () => {
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName,
    variant: 'main'
  })
  const attr = attribute(
    new TestProducer(key, new StackTrail(['components', 'schemas', 'User', 'properties', 'email']))
  )

  assertEquals(attr.schemaPointer, '#/components/schemas/User/properties/email')
})

Deno.test('attribute - Definition producer populates defName from identifier', () => {
  const ctx = stubContext()
  const value = new TestProducer(undefined)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'GREETING' }),
    value
  })

  const attr = attribute(def)
  assertEquals(attr.definitionName, 'GREETING')
})

Deno.test('attribute - RFC 6901 escapes ~ and / in OAS path segments', () => {
  // A path with both reserved characters — exercises the ordering of
  // ~ → ~0 (must happen first) and / → ~1 substitutions.
  const key = toOasOperationGeneratorKey({
    generatorId: 'g',
    path: '/api/v~1/items/{id}',
    method: 'get',
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  // Each `/` becomes `~1`; the literal `~` in `v~1` becomes `~0`,
  // and then the `1` after it stays a literal `1` — overall the
  // sub-segment `v~1` round-trips as `v~01`.
  assertEquals(attr.schemaPointer, '#/paths/~1api~1v~01~1items~1{id}/get')
})
