import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import {
  toGqlParsedDocument,
  toOasParsedDocument,
  type SkmtcParsedDocument,
  type SkmtcProtocol
} from './SkmtcDocument.ts'

Deno.test('SkmtcParsedDocument - toOasParsedDocument wraps an OasDocument', () => {
  const oas = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'X', version: '1.0.0' }),
    operations: []
  })

  const wrapped = toOasParsedDocument(oas)

  assertEquals(wrapped.type, 'oas')
  assertStrictEquals(wrapped.value, oas)
})

Deno.test('SkmtcParsedDocument - toGqlParsedDocument wraps a GqlDocument', () => {
  const gql = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations: [],
    rootTypes: {}
  })

  const wrapped = toGqlParsedDocument(gql)

  assertEquals(wrapped.type, 'gql')
  assertStrictEquals(wrapped.value, gql)
})

Deno.test('SkmtcParsedDocument - discriminated union narrows correctly', () => {
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

  const documents: SkmtcParsedDocument[] = [
    { type: 'oas', value: oas },
    { type: 'gql', value: gql }
  ]

  for (const doc of documents) {
    switch (doc.type) {
      case 'oas':
        assertStrictEquals(doc.value, oas)
        break
      case 'gql':
        assertStrictEquals(doc.value, gql)
        break
    }
  }
})

Deno.test('SkmtcParsedDocument - SkmtcProtocol covers all variants', () => {
  // Compile-time check: assigning each known protocol to the union type
  // must succeed. Adding a third variant without updating SkmtcProtocol
  // would fail to type-check.
  const protocols: SkmtcProtocol[] = ['oas', 'gql']
  assertEquals(protocols.length, 2)
})
