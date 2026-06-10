import { assertEquals, assertStrictEquals } from '@std/assert'
import { GqlDocument } from './GqlDocument.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasString } from '@/oas/string/String.ts'
import type { RefName } from '@/types/RefName.ts'

const refName = (s: string) => s as unknown as RefName

Deno.test('GqlDocument - exposes registry and operations', () => {
  const registry = new GqlRegistry({
    schemas: { [refName('User')]: new OasString({}) }
  })
  const operation = new GqlOperation({
    rootKind: 'query',
    fieldName: 'getUser',
    arguments: [],
    returnType: new OasString({})
  })

  const doc = new GqlDocument({
    registry,
    operations: [operation],
    rootTypes: { query: refName('Query') }
  })

  assertStrictEquals(doc.registry, registry)
  assertEquals(doc.operations.length, 1)
  assertStrictEquals(doc.operations[0], operation)
  assertEquals(doc.rootTypes.query, refName('Query'))
})

Deno.test('GqlDocument - info defaults to undefined', () => {
  const doc = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {}
  })

  assertEquals(doc.info, undefined)
})

Deno.test('GqlDocument - oasType discriminator is gqlDocument', () => {
  const doc = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {}
  })

  assertEquals(doc.oasType, 'gqlDocument')
})

Deno.test('GqlDocument - retains optional info', () => {
  const info = new OasInfo({ title: 'X', version: '1.0.0' })
  const doc = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {},
    info
  })

  assertStrictEquals(doc.info, info)
})
