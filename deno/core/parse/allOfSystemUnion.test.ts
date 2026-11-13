import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import { toRefName } from '@/helpers/refFns.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Unions', version: '1' },
    paths: {},
    components: {
      schemas: {
        // Cloudflare's envelopes: the common response says `success` is true, an error response that it is false.
        Common: { type: 'object', properties: { success: { type: 'boolean', enum: [true] } } },
        Failure: {
          allOf: [
            { $ref: '#/components/schemas/Common' },
            { type: 'object', properties: { success: { type: 'boolean', enum: [false] } } }
          ]
        },
        Other: { type: 'object', properties: { id: { type: 'string' } } },
        // `zones_setting`: a `type` beside the `oneOf` is merged into each member.
        Either: { type: 'object', oneOf: [{ $ref: '#/components/schemas/Failure' }, { $ref: '#/components/schemas/Other' }] },
        // Cloudflare's collections: the common response says `result` is an object or a string, a collection an array.
        Collection: {
          type: 'object',
          properties: { result: { oneOf: [{ type: 'object' }, { type: 'string' }] } },
          oneOf: [{ type: 'object', properties: { result: { type: 'array', items: { type: 'string' } } } }]
        },
        CollectionOrName: {
          type: 'object',
          properties: { result: { oneOf: [{ type: 'object' }, { type: 'string' }] } },
          oneOf: [
            { type: 'object', properties: { result: { type: 'array', items: { type: 'string' } } } },
            { type: 'object', properties: { result: { type: 'string', minLength: 1 } } }
          ]
        }
      }
    }
  }) as OpenAPIV3.Document

type ParseArgs = {
  openapi: string
  system: SystemSettings | undefined
}

const parse = ({ openapi, system }: ParseArgs) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined
  const toSchema = (name: string): OasSchema | OasRef<'schema'> | undefined =>
    schemas?.[toRefName(`#/components/schemas/${name}`)]
  // `Collection` must not count the errors of `CollectionOrName`.
  const errorsAt = (name: string): number =>
    context.issues.filter(({ level, location }) =>
      level === 'error' && `${location}:`.includes(`components:schemas:${name}:`)
    ).length

  return { toSchema, errorsAt }
}

/** Each member of a union, or the schema itself, as its properties and their types. */
const toShapes = (schema: OasSchema | OasRef<'schema'> | undefined) => {
  const members = schema?.type === 'union' ? schema.members : [schema]

  return members.map(member =>
    member === undefined || member.isRef() || member.type !== 'object'
      ? undefined
      : Object.fromEntries(
          Object.entries(member.properties ?? {}).map(([name, property]) => [
            name,
            property.isRef() ? 'ref' : property.type === 'boolean' ? `boolean ${property.enums}` : property.type
          ])
        )
  )
}

for (const openapi of ['3.0.3', '3.1.0']) {
  Deno.test(`${openapi} latestWins: a union member whose own allOf contradicts is kept, the later member winning`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { allOf: 'latestWins' } })

    // The trap: the first pass over the pairs merged Failure's own allOf as strict, so Failure
    // was left out of the union, and nothing was logged where the union is.
    assertEquals(toShapes(toSchema('Either')), [{ success: 'boolean false' }, { id: 'string' }])
    assertEquals(errorsAt('Either'), 0)
  })

  Deno.test(`${openapi} strict: a union member whose own allOf contradicts has no value, and is left out, as before`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: undefined })

    assertEquals(toShapes(toSchema('Either')), [{ id: 'string' }])
    assertEquals(errorsAt('Failure'), 1)
  })

  Deno.test(`${openapi} latestWins: when a pair's members contradict deeper down, the later member wins`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { allOf: 'latestWins' } })

    // The trap: `result` merged to an empty oneOf in the first pass, the pair counted as merged,
    // and the schema failed with `"oneOf" array is empty`.
    assertEquals(toShapes(toSchema('Collection')), [{ result: 'array' }])
    assertEquals(errorsAt('Collection'), 0)
  })

  Deno.test(`${openapi} latestWins: a pair that contradicts deeper down is left out when another pair merges`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { allOf: 'latestWins' } })

    assertEquals(toShapes(toSchema('CollectionOrName')), [{ result: 'string' }])
    assertEquals(errorsAt('CollectionOrName'), 0)
  })

  Deno.test(`${openapi} strict: a pair that contradicts deeper down still fails the schema, as before`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: undefined })

    assertEquals(toSchema('Collection'), undefined)
    assertEquals(errorsAt('Collection'), 1)
  })
}
