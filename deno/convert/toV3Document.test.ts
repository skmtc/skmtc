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

// The down-convert HALF of the nullable-collapse contract. The core parse
// half (single-member oneOf/anyOf collapse → nullable scalar / nullable
// OasRef) is pinned in core/oas/schema/toSchemasV3.test.ts; these tests pin
// the exact shapes those consume, so the two layers meet at a known
// interface. (`convert` deliberately does not depend on `core`, so this is
// a two-layer contract rather than one cross-package end-to-end test.)
Deno.test('toV3Document - 3.1 nullable scalar oneOf collapses to single member + nullable', async () => {
  const doc: OpenAPIV3_1.Document = {
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    paths: {},
    components: {
      schemas: {
        MaybeName: { oneOf: [{ type: 'string' }, { type: 'null' }] }
      }
    }
  }

  const result = await toV3Document(doc)
  const schema = result.components?.schemas?.MaybeName
  if (!schema || '$ref' in schema) {
    throw new Error('Expected inline schema for MaybeName')
  }
  assertEquals(schema.nullable, true)
  assertEquals(schema.oneOf?.length, 1)
})

Deno.test('toV3Document - 3.1 nullable $ref (oneOf) keeps single $ref member + nullable', async () => {
  // 3.1 encodes a nullable reference as `oneOf:[{$ref},{type:null}]`. 3.0 has
  // no null type, so the down-converter keeps `oneOf:[{$ref}]` and marks the
  // wrapper `nullable:true` ("3.0's encoding for a nullable reference"). Core
  // stamps that nullable onto the OasRef node.
  const doc: OpenAPIV3_1.Document = {
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    paths: {},
    components: {
      schemas: {
        Foo: { type: 'object', properties: { id: { type: 'string' } } },
        MaybeFoo: { oneOf: [{ $ref: '#/components/schemas/Foo' }, { type: 'null' }] }
      }
    }
  }

  const result = await toV3Document(doc)
  const schema = result.components?.schemas?.MaybeFoo
  if (!schema || '$ref' in schema) {
    throw new Error('Expected inline (oneOf) schema for MaybeFoo')
  }
  assertEquals(schema.nullable, true)
  assertEquals(schema.oneOf?.length, 1)
  const member = schema.oneOf?.[0]
  assertEquals(member && '$ref' in member ? member.$ref : undefined, '#/components/schemas/Foo')
})

Deno.test('toV3Document - 3.1 nullable $ref (anyOf) keeps single $ref member + nullable', async () => {
  const doc: OpenAPIV3_1.Document = {
    openapi: '3.1.0',
    info: { title: 'T', version: '1' },
    paths: {},
    components: {
      schemas: {
        Foo: { type: 'object', properties: { id: { type: 'string' } } },
        MaybeFoo: { anyOf: [{ $ref: '#/components/schemas/Foo' }, { type: 'null' }] }
      }
    }
  }

  const result = await toV3Document(doc)
  const schema = result.components?.schemas?.MaybeFoo
  if (!schema || '$ref' in schema) {
    throw new Error('Expected inline (anyOf) schema for MaybeFoo')
  }
  assertEquals(schema.nullable, true)
  assertEquals(schema.anyOf?.length, 1)
})
