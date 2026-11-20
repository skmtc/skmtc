import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { toRefName } from '@/helpers/refFns.ts'

const document = {
  openapi: '3.0.3',
  info: { title: 'Read-only', version: '1' },
  paths: {},
  components: {
    schemas: {
      Timestamp: { type: 'string', format: 'date-time' },
      Id: { type: 'string', readOnly: true },
      Policy: {
        type: 'object',
        properties: {
          // Read-only at this site only: the 3.0 idiom.
          created_at: { allOf: [{ $ref: '#/components/schemas/Timestamp' }], readOnly: true },
          // Read-only where the reference points.
          id: { $ref: '#/components/schemas/Id' },
          // Read-only on the property itself.
          etag: { type: 'string', readOnly: true },
          name: { type: 'string' },
          // writeOnly at this site, and on an object: OasObject once dropped its writeOnly.
          secret: { allOf: [{ $ref: '#/components/schemas/Timestamp' }], writeOnly: true },
          profile: { type: 'object', writeOnly: true },
          updated_at: { $ref: '#/components/schemas/Timestamp' }
        }
      }
    }
  }
} as OpenAPIV3.Document

const policy = () => {
  const parsed = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))
  const schema = parsed.type === 'oas' ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Policy')] : undefined

  if (!(schema instanceof OasObject) || !schema.properties) {
    throw new Error('Policy did not parse to an object')
  }

  return schema.properties
}

Deno.test('isReadOnly() reads readOnly on the reference, where it points, or on the property', () => {
  const properties = policy()

  assertEquals(properties.created_at.isReadOnly(), true)
  assertEquals(properties.id.isReadOnly(), true)
  assertEquals(properties.etag.isReadOnly(), true)
  // The trap: the shared Timestamp model is not read-only; only the site that says so is.
  assertEquals(properties.updated_at.isReadOnly(), false)
  assertEquals(properties.name.isReadOnly(), false)
})

Deno.test('isWriteOnly() reads writeOnly on the reference, or on the schema, an object too', () => {
  const properties = policy()

  assertEquals(properties.secret.isWriteOnly(), true)
  assertEquals(properties.profile.isWriteOnly(), true)
  // writeOnly is not readOnly, and the reverse.
  assertEquals(properties.secret.isReadOnly(), false)
  assertEquals(properties.created_at.isWriteOnly(), false)
  assertEquals(properties.updated_at.isWriteOnly(), false)
})

/** The schemas parsed from `components.schemas`, with a loop of `$ref`s kept (`system.danglingRefs`). */
const toSchemas = (schemas: Record<string, unknown>) => {
  const parsed = new ParseContext({
    input: {
      type: 'oas',
      // Documents in the wild hold what the parser's input type does not allow.
      value: JSON.parse(JSON.stringify({ openapi: '3.0.3', info: { title: 'Chains', version: '1' }, paths: {}, components: { schemas } }))
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system: { danglingRefs: ['schema'] }
  }).parse(new StackTrail(['TEST']))

  return (name: string) =>
    parsed.type === 'oas' ? parsed.value.components?.schemas?.[toRefName(`#/components/schemas/${name}`)] : undefined
}

Deno.test('isReadOnly() and isWriteOnly() follow a chain of any length to its schema, as resolve() does', () => {
  // `S0` → `S1` → … → `S12`, a read-only string. Both stopped after 10 steps and said `false`.
  const chain = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [`S${index}`, { $ref: `#/components/schemas/S${index + 1}` }])
  )
  const toSchema = toSchemas({ ...chain, S12: { type: 'string', readOnly: true } })
  const head = toSchema('S0')

  assert(head !== undefined && head.isRef())
  assertEquals(head.resolve().isReadOnly(), true)
  assertEquals(head.isReadOnly(), true)
  assertEquals(head.isWriteOnly(), false)
})

Deno.test('isReadOnly() and isWriteOnly() end at a loop of $refs, which reaches no schema', () => {
  const toSchema = toSchemas({ A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } })
  const a = toSchema('A')

  assert(a !== undefined && a.isRef())
  assertEquals(a.isReadOnly(), false)
  assertEquals(a.isWriteOnly(), false)
})
