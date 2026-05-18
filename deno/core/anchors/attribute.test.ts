import { assertEquals } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { Definition } from '@/dsl/Definition.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import {
  toOasOperationGeneratorKey,
  toGqlOperationGeneratorKey,
  toModelGeneratorKey,
  toGeneratorOnlyKey
} from '@/dsl/GeneratorKeys.ts'
import { attribute } from './attribute.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'

const stubContext = (): GenerateContextType =>
  ({}) as unknown as GenerateContextType

class TestProducer extends SnippetBase {
  constructor(generatorKey?: GeneratorKey, srcPtrOverride?: string) {
    super({ context: stubContext(), generatorKey })
    if (srcPtrOverride !== undefined) this.srcPtr = srcPtrOverride
  }

  override toString(): string {
    return ''
  }
}

Deno.test('attribute - OAS operation key produces oas:#/paths/<path>/<method>', () => {
  const key = toOasOperationGeneratorKey({
    generatorId: '@scope/gen-ts',
    path: '/users/{id}',
    method: 'get',
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.genId, '@scope/gen-ts')
  assertEquals(attr.srcPtr, 'oas:#/paths/~1users~1{id}/get')
  assertEquals(attr.variant, 'main')
  assertEquals(attr.defName, undefined)
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

Deno.test('attribute - GQL operation key produces gql:<rootKind>.<fieldName>', () => {
  const key = toGqlOperationGeneratorKey({
    generatorId: '@scope/gen-gql',
    rootKind: 'query',
    fieldName: 'getUser',
    variant: 'main'
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.genId, '@scope/gen-gql')
  assertEquals(attr.srcPtr, 'gql:query.getUser')
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - Model key produces oas:#/components/schemas/<refName>', () => {
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName
  })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.genId, '@scope/gen-zod')
  assertEquals(attr.srcPtr, 'oas:#/components/schemas/User')
  // Model keys have no variant axis — default to 'main'.
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - generator-only key yields undefined srcPtr', () => {
  const key = toGeneratorOnlyKey({ generatorId: '@scope/gen-utils' })
  const attr = attribute(new TestProducer(key))

  assertEquals(attr.genId, '@scope/gen-utils')
  assertEquals(attr.srcPtr, undefined)
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - producer with no generatorKey returns <unknown>', () => {
  const attr = attribute(new TestProducer(undefined))

  assertEquals(attr.genId, '<unknown>')
  assertEquals(attr.srcPtr, undefined)
  assertEquals(attr.variant, 'main')
})

Deno.test('attribute - explicit srcPtr field overrides key-derived pointer', () => {
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName
  })
  const attr = attribute(new TestProducer(key, 'oas:#/components/schemas/User/properties/email'))

  assertEquals(attr.srcPtr, 'oas:#/components/schemas/User/properties/email')
})

Deno.test('attribute - Definition producer populates defName from identifier', () => {
  const ctx = stubContext()
  const value = new TestProducer(undefined)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('GREETING'),
    value
  })

  const attr = attribute(def)
  assertEquals(attr.defName, 'GREETING')
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
  assertEquals(attr.srcPtr, 'oas:#/paths/~1api~1v~01~1items~1{id}/get')
})
