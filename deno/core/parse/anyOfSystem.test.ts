import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import { toRefName } from '@/helpers/refFns.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

const named = { $ref: '#/components/schemas/Named' }

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'AnyOf', version: '1' },
    paths: {},
    components: {
      schemas: {
        Named: { type: 'object', properties: { id: { type: 'string' } } },
        // Cloudflare's stream copy body: properties next to an `anyOf` that requires one of two.
        StreamCopy: {
          type: 'object',
          properties: { input: { type: 'string' }, url: { type: 'string' }, creator: { type: 'string' } },
          anyOf: [
            { type: 'object', required: ['input'] },
            { type: 'object', required: ['url'] }
          ]
        },
        // Cloudflare's purge cache body: an `anyOf` and nothing next to it.
        PurgeCache: {
          anyOf: [
            { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } } },
            { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } }
          ]
        },
        // An `allOf` member's `anyOf`: the merge leaves it out too.
        NamedWithCode: {
          allOf: [
            named,
            {
              anyOf: [
                { type: 'object', required: ['id'] },
                { type: 'object', properties: { code: { type: 'string' } } }
              ]
            }
          ]
        },
        // A nullable reference, as each version writes one with `anyOf`.
        MaybeNamed: openapi.startsWith('3.0') ? { anyOf: [named], nullable: true } : { anyOf: [named, { type: 'null' }] }
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
  const issuesAt = (name: string) =>
    context.issues.filter(({ location }) => location.endsWith(`components:schemas:${name}`))
  const warningsAt = (name: string): number => issuesAt(name).filter(({ type }) => type === 'ANYOF_AS_UNKNOWN').length
  const errorsAt = (name: string): number => issuesAt(name).filter(({ level }) => level === 'error').length

  return { toSchema, warningsAt, errorsAt }
}

/** The property names of a parsed object, or `undefined` for any other schema. */
const toPropertyNames = (schema: OasSchema | OasRef<'schema'> | undefined): string[] | undefined =>
  schema?.type === 'object' ? Object.keys(schema.properties ?? {}) : undefined

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} system.anyOf unknown: the properties next to an anyOf stay, and its members are left out`, () => {
    const { toSchema, warningsAt, errorsAt } = parse({ openapi, system: { anyOf: 'unknown' } })
    const streamCopy = toSchema('StreamCopy')

    // The trap: under `union` each member gets the three properties, so the object is lost in a union.
    assertEquals(streamCopy?.type, 'object')
    assertEquals(toPropertyNames(streamCopy), ['input', 'url', 'creator'])
    // `input` or `url`: the members' requirement is left out with them, as cf reads it.
    assertEquals(streamCopy?.type === 'object' ? streamCopy.required : 'not an object', undefined)
    assertEquals([warningsAt('StreamCopy'), errorsAt('StreamCopy')], [1, 0])
  })

  Deno.test(`${openapi} system.anyOf unknown: an anyOf with nothing next to it is unknown`, () => {
    const { toSchema, warningsAt } = parse({ openapi, system: { anyOf: 'unknown' } })

    assertEquals(toSchema('PurgeCache')?.type, 'unknown')
    assertEquals(warningsAt('PurgeCache'), 1)
  })

  Deno.test(`${openapi} system.anyOf unknown: an allOf member's anyOf is left out of the merge`, () => {
    const { toSchema, warningsAt, errorsAt } = parse({ openapi, system: { anyOf: 'unknown' } })
    const namedWithCode = toSchema('NamedWithCode')

    // The trap: the merge crossed the anyOf with `Named` before the anyOf branch could see it.
    assertEquals(namedWithCode?.type, 'object')
    assertEquals(toPropertyNames(namedWithCode), ['id'])
    assertEquals([warningsAt('NamedWithCode'), errorsAt('NamedWithCode')], [1, 0])
  })

  Deno.test(`${openapi} system.anyOf unknown: an anyOf with one member besides null stays a nullable reference`, () => {
    const { toSchema, warningsAt } = parse({ openapi, system: { anyOf: 'unknown' } })
    const maybeNamed = toSchema('MaybeNamed')

    // The trap: this is how a 3.1 document writes `Named | null`; any value would lose the model.
    assertEquals(maybeNamed?.isRef(), true)
    assertEquals(maybeNamed?.isRef() ? maybeNamed.nullable : undefined, true)
    assertEquals(warningsAt('MaybeNamed'), 0)
  })

  Deno.test(`${openapi} with no system settings, an anyOf is a union, as before`, () => {
    const { toSchema, warningsAt } = parse({ openapi, system: undefined })
    const streamCopy = toSchema('StreamCopy')
    const members = streamCopy?.type === 'union' ? streamCopy.members : []

    // The trap: `union` is the default, so an unconfigured project parses as it always has.
    assertEquals(members.map(member => (member.isRef() ? undefined : toPropertyNames(member))), [
      ['input', 'url', 'creator'],
      ['input', 'url', 'creator']
    ])
    assertEquals(toSchema('PurgeCache')?.type, 'union')
    assertEquals(warningsAt('StreamCopy'), 0)
  })
}
