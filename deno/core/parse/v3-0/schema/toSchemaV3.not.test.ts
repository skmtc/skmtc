/**
 * The `not` keyword has no faithful TypeScript representation — a generated
 * type that ignored it would *widen* the schema's contract (accepting shapes
 * the schema forbids). `toSchemaV3` therefore refuses any schema carrying
 * `not`: the throw is isolated by `tryParseAt` into an `INVALID_SCHEMA` issue,
 * the schema is dropped from the parsed document, and its consumers are pruned
 * with `INVALID_DEPENDENCY_REF`.
 *
 * This reverses the earlier "ride the union wrapper, ignored" behaviour, which
 * silently emitted a too-permissive type. See `_merge-all-of/decompose-union.ts`
 * (`not` no longer in `excludedProperties`) and the guard in `toSchemasV3.ts`.
 */
import { assertEquals } from '@std/assert'
import type * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const makeOasContext = (documentObject: OpenAPIV3.Document) =>
  new ParseContext({
    input: { type: 'oas', value: documentObject },
    logger: mockLogger,
    silent: true
  })

Deno.test('toSchemaV3 - object schema using `not` is refused with INVALID_SCHEMA', () => {
  const ctx = makeOasContext({
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        Forbidden: {
          type: 'object',
          properties: { id: { type: 'string' } },
          not: { required: ['secret'] }
        }
      }
    }
  })

  ctx.parse(new StackTrail([]))

  const schemaIssues = ctx.issues.filter(
    i => i.type === 'INVALID_SCHEMA' && i.location === 'components:schemas:Forbidden'
  )
  assertEquals(schemaIssues.length, 1, 'the `not`-bearing schema is flagged INVALID_SCHEMA')
  assertEquals(schemaIssues[0].level, 'error')
})

Deno.test('toSchemaV3 - `not` as a union sibling is refused (was silently ignored)', () => {
  // The exact shape that previously "rode the union wrapper": an object with
  // an anyOf-of-required plus a `not` forbidding both at once. Now refused
  // rather than emitted as a type that drops the `not` constraint.
  const ctx = makeOasContext({
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        ImageReference: {
          type: 'object',
          properties: { image_url: { type: 'string' }, file_id: { type: 'string' } },
          anyOf: [{ required: ['image_url'] }, { required: ['file_id'] }],
          not: { required: ['image_url', 'file_id'] }
        }
      }
    }
  })

  ctx.parse(new StackTrail([]))

  assertEquals(
    ctx.issues.some(
      i => i.type === 'INVALID_SCHEMA' && i.location === 'components:schemas:ImageReference'
    ),
    true,
    'a `not` sibling on a union is refused, not silently dropped'
  )
})

Deno.test('toSchemaV3 - consumers of a `not`-bearing schema are pruned with INVALID_DEPENDENCY_REF', () => {
  const ctx = makeOasContext({
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/things': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Thing' } }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Thing: {
          type: 'object',
          properties: { id: { type: 'string' } },
          not: { required: ['secret'] }
        }
      }
    }
  })

  ctx.parse(new StackTrail([]))

  // The consuming operation is pruned because its referenced schema failed.
  assertEquals(ctx.oasDocument.operations.length, 0, 'the consuming operation is pruned')

  // ...and the prune is reported as INVALID_DEPENDENCY_REF, located at the consumer.
  const depRefIssues = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRefIssues.length, 1, 'one consumer pruned → one INVALID_DEPENDENCY_REF')
  assertEquals(depRefIssues[0].location.startsWith('paths:'), true)
})
