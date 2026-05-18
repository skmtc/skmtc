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

Deno.test('toV3Document - 3.1 input is down-converted to 3.0', async () => {
  // `type: [..., "null"]` is the canonical 3.1-only nullability form
  // and the down-converter is expected to rewrite it to `nullable: true`.
  const doc: OpenAPIV3_1.Document = {
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

Deno.test(
  'toV3Document - 3.1 numeric exclusiveMinimum is rewritten to 3.0 boolean form (friction #12)',
  async () => {
    // OpenAPI 3.1 (JSON Schema 2020-12) allows `exclusiveMinimum: N`.
    // OpenAPI 3.0 needs `{minimum: N, exclusiveMinimum: true}`. Without
    // the rewrite, SKMTC's integer parser sees a non-boolean
    // exclusiveMinimum and throws a ValiError.
    const doc: OpenAPIV3_1.Document = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {},
      components: {
        schemas: {
          PositiveInt: {
            type: 'integer',
            exclusiveMinimum: 0
          },
          CappedInt: {
            type: 'integer',
            exclusiveMaximum: 100
          }
        }
      }
    }

    const result = await toV3Document(doc)
    const positive = result.components?.schemas?.PositiveInt
    const capped = result.components?.schemas?.CappedInt
    if (!positive || '$ref' in positive || !capped || '$ref' in capped) {
      throw new Error('Expected inline schemas')
    }
    assertEquals(positive.minimum, 0)
    assertEquals(positive.exclusiveMinimum, true)
    assertEquals(capped.maximum, 100)
    assertEquals(capped.exclusiveMaximum, true)
  }
)

Deno.test(
  'toV3Document - existing `minimum` is preserved when stricter than `exclusiveMinimum`',
  async () => {
    // 3.1 lets `minimum` and `exclusiveMinimum` coexist as separate
    // constraints. We must merge to the stricter bound rather than
    // producing the (3.0-illegal) coexistence.
    //
    // `{minimum: 10, exclusiveMinimum: 5}`: inclusive 10 is stricter
    // than exclusive 5 (value >= 10 already excludes 5). Drop
    // exclusiveMinimum, keep minimum.
    const doc: OpenAPIV3_1.Document = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {},
      components: {
        schemas: {
          M: { type: 'integer', minimum: 10, exclusiveMinimum: 5 }
        }
      }
    }
    const result = await toV3Document(doc)
    const m = result.components?.schemas?.M
    if (!m || '$ref' in m) throw new Error('Expected inline schema')
    assertEquals(m.minimum, 10)
    // exclusiveMinimum should NOT be present at all — the merge dropped it.
    assertEquals(m.exclusiveMinimum, undefined)
  }
)

Deno.test(
  'toV3Document - `exclusiveMinimum: number` wins when stricter than `minimum`',
  async () => {
    // `{minimum: 5, exclusiveMinimum: 10}`: exclusive 10 is stricter
    // (value > 10 vs value >= 5). Convert to {minimum: 10,
    // exclusiveMinimum: true}.
    const doc: OpenAPIV3_1.Document = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {},
      components: {
        schemas: {
          M: { type: 'integer', minimum: 5, exclusiveMinimum: 10 }
        }
      }
    }
    const result = await toV3Document(doc)
    const m = result.components?.schemas?.M
    if (!m || '$ref' in m) throw new Error('Expected inline schema')
    assertEquals(m.minimum, 10)
    assertEquals(m.exclusiveMinimum, true)
  }
)

Deno.test(
  'toV3Document - boolean `exclusiveMinimum` is left alone (already 3.0 shape)',
  async () => {
    // A 3.0-style schema that comes through the 3.1 codepath
    // (rare but possible if the openapi version field is set to 3.1
    // but the schemas are pre-3.0-shaped). The converter shouldn't
    // touch already-boolean exclusiveMinimum.
    // Deliberately 3.0-shaped (`exclusiveMinimum: true`) under a 3.1
    // openapi field — exercises the "leave alone" branch in the
    // converter. Casts to OpenAPIV3_1.Document because the shape is
    // intentionally malformed for the spec version it claims to be.
    const doc = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {},
      components: {
        schemas: {
          M: { type: 'integer', minimum: 5, exclusiveMinimum: true }
        }
      }
    } as unknown as OpenAPIV3_1.Document
    const result = await toV3Document(doc)
    const m = result.components?.schemas?.M
    if (!m || '$ref' in m) throw new Error('Expected inline schema')
    assertEquals(m.minimum, 5)
    assertEquals(m.exclusiveMinimum, true)
  }
)

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
