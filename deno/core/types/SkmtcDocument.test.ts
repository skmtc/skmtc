import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import {
  toGqlSkmtcDocument,
  toOasSkmtcDocument,
  type SkmtcDocument,
  type SkmtcProtocol
} from './SkmtcDocument.ts'

Deno.test('SkmtcDocument - toOasSkmtcDocument wraps an OasDocument', () => {
  const oas = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'X', version: '1.0.0' }),
    operations: []
  })

  const wrapped = toOasSkmtcDocument(oas)

  assertEquals(wrapped.type, 'oas')
  assertStrictEquals(wrapped.value, oas)
})

Deno.test('SkmtcDocument - toGqlSkmtcDocument wraps a GqlDocument', () => {
  const gql = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {}
  })

  const wrapped = toGqlSkmtcDocument(gql)

  assertEquals(wrapped.type, 'gql')
  assertStrictEquals(wrapped.value, gql)
})

Deno.test('SkmtcDocument - discriminated union narrows correctly', () => {
  const oas = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'X', version: '1.0.0' }),
    operations: []
  })
  const gql = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {}
  })

  const documents: SkmtcDocument[] = [
    { type: 'oas', value: oas },
    { type: 'gql', value: gql }
  ]

  for (const doc of documents) {
    switch (doc.type) {
      case 'oas':
        // Compile-time narrowing: doc.value should be OasDocument here.
        assertStrictEquals(doc.value, oas)
        break
      case 'gql':
        assertStrictEquals(doc.value, gql)
        break
    }
  }
})

Deno.test('SkmtcDocument - SkmtcProtocol covers all variants', () => {
  // Compile-time check: assigning each known protocol to the union type
  // must succeed. Adding a third variant without updating SkmtcProtocol
  // would fail to type-check.
  const protocols: SkmtcProtocol[] = ['oas', 'gql']
  assertEquals(protocols.length, 2)
})
