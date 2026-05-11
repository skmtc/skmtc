import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
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

Deno.test('toV3Document - 3.1 input is down-converted to 3.0', async () => {
  // `type: [..., "null"]` is the canonical 3.1-only nullability form
  // and the down-converter is expected to rewrite it to `nullable: true`.
  const doc = {
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    paths: {},
    components: {
      schemas: {
        Maybe: {
          type: ['string', 'null']
        }
      }
    }
  }

  const result = await toV3Document(doc)

  assertEquals(result.openapi.startsWith('3.0'), true, 'openapi version must be 3.0.x')

  const schema = result.components?.schemas?.Maybe
  if (!schema || '$ref' in schema) {
    throw new Error('Expected inline schema for Maybe')
  }
  assertEquals(schema.type, 'string')
  assertEquals(schema.nullable, true)
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
