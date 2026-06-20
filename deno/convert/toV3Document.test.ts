import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import type { OpenAPIV3_1 } from 'openapi-types'
import { toV3Document } from './toV3Document.ts'

Deno.test('toV3Document - 3.0 input is returned unchanged', async () => {
  const doc = {
    openapi: '3.0.3',
    info: { title: 'T', version: '1' },
    paths: {}
  }

  const result = await toV3Document(doc)

  assertEquals(result, doc)
})

Deno.test('toV3Document - 3.1 input is passed through unchanged (no down-convert)', async () => {
  // SKMTC parses OpenAPI 3.1 natively (core/parse/v3-1), so toV3Document no
  // longer down-converts it. The document is returned exactly as given, with
  // every 3.1-only idiom intact for the native parser to handle. (The
  // down-conversion that used to happen here — type-array → nullable, const →
  // enum, numeric exclusiveMinimum → boolean, oneOf null-member collapse — now
  // lives in the v3-1 parser; the @skmtc/openapi-down-convert Converter's own
  // behavior is still covered by openapi-down-convert/converter.test.ts.)
  const doc: OpenAPIV3_1.Document = {
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    webhooks: {
      newPet: { post: { responses: { '200': { description: 'ok' } } } }
    },
    components: {
      schemas: {
        Foo: { type: 'object', properties: { id: { type: 'string' } } },
        Maybe: { type: ['string', 'null'] },
        Status: { const: 'active' },
        Positive: { type: 'integer', exclusiveMinimum: 0 },
        MaybeFoo: { oneOf: [{ $ref: '#/components/schemas/Foo' }, { type: 'null' }] }
      }
    }
  }

  const result = await toV3Document(doc)

  // Same document back — version unchanged, every 3.1 idiom preserved.
  assertEquals(result.openapi, '3.1.0')

  const read = (name: string): Record<string, unknown> => {
    const schema = result.components?.schemas?.[name]
    if (!schema || '$ref' in schema) throw new Error(`Expected inline schema for ${name}`)
    return schema as unknown as Record<string, unknown>
  }

  assertEquals(read('Maybe').type, ['string', 'null']) // not flattened to nullable
  assertEquals(read('Status').const, 'active') // not rewritten to enum
  assertEquals(read('Positive').exclusiveMinimum, 0) // still numeric, not boolean
  assertEquals((read('MaybeFoo').oneOf as unknown[]).length, 2) // null member not collapsed

  const webhooks = (result as { webhooks?: Record<string, unknown> }).webhooks
  assertEquals(Boolean(webhooks?.newPet), true) // webhooks present, not removed
})

Deno.test('toV3Document - unrecognized version includes version field in error', async () => {
  await assertRejects(
    () => toV3Document({ openapi: '4.2', info: { title: 'T', version: '1' }, paths: {} } as never),
    Error,
    'openapi=4.2'
  )
})

Deno.test('toV3Document - missing version field is reported clearly', async () => {
  const err = await assertRejects(
    () => toV3Document({ info: { title: 'T', version: '1' }, paths: {} } as never),
    Error
  )
  assertStringIncludes(err.message, 'no version field found')
})
