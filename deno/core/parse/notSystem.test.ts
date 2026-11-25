import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

// Cloudflare's browser-rendering bodies: a URL or HTML, and not both.
const onlyUrl = {
  type: 'object',
  properties: { url: { type: 'string' }, html: { type: 'string' } },
  required: ['url'],
  not: { required: ['html'] }
}
const onlyHtml = {
  type: 'object',
  properties: { url: { type: 'string' }, html: { type: 'string' } },
  required: ['html'],
  not: { required: ['url'] }
}

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Not', version: '1' },
    paths: {},
    components: {
      schemas: {
        QuickAction: { oneOf: [onlyUrl, onlyHtml] },
        OnlyUrl: onlyUrl,
        // Merged: the `not` of the referenced member is kept by the merge.
        WithWait: {
          allOf: [{ $ref: '#/components/schemas/OnlyUrl' }, { type: 'object', properties: { wait: { type: 'integer' } } }]
        },
        AnythingButAString: { not: { type: 'string' } },
        Named: { type: 'object', properties: { id: { type: 'string' } } },
        NamedButNotEmpty: { description: 'd', allOf: [{ $ref: '#/components/schemas/Named' }], not: { maxProperties: 0 } },
        NamedAnyOf: { nullable: true, anyOf: [{ $ref: '#/components/schemas/Named' }], not: { maxProperties: 0 } },
        // Its `type` says nothing more than the kept reference.
        Tree: {
          type: 'object',
          properties: {
            parent: { type: 'object', nullable: true, anyOf: [{ $ref: '#/components/schemas/Tree' }], not: { required: ['x'] } }
          }
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
    schemas?.[(name as RefName)]
  const errorsAt = (name: string): number =>
    context.issues.filter(({ level, location }) => level === 'error' && location.endsWith(`components:schemas:${name}`))
      .length

  return { toSchema, errorsAt }
}

/** The `not` a parsed schema keeps, as its type and pointer. */
const toNot = (schema: OasSchema | OasRef<'schema'> | undefined) =>
  schema === undefined || schema.isRef() || schema.not === undefined
    ? undefined
    : { type: schema.not.type, pointer: schema.not.stackTrail.toJsonPointer() }

const toProperty = (schema: OasSchema | OasRef<'schema'> | undefined, name: string) => {
  const property = schema?.isRef() === false && schema.type === 'object' ? schema.properties?.[name] : undefined

  return property === undefined || property.type === 'custom' ? undefined : property
}

for (const openapi of ['3.0.3', '3.1.0']) {
  Deno.test(`${openapi} system.not unknown: a schema with not parses with its other keywords, and keeps the not`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { not: 'unknown' } })
    const onlyUrl = toSchema('OnlyUrl')

    assertEquals(onlyUrl?.type, 'object')
    assertEquals(onlyUrl?.type === 'object' ? onlyUrl.required : undefined, ['url'])
    // The pointer starts with the test's own `TEST` frame, as the schema's does.
    assertEquals(toNot(onlyUrl), { type: 'unknown', pointer: '#/TEST/components/schemas/OnlyUrl/not' })
    assertEquals(errorsAt('OnlyUrl'), 0)
  })

  Deno.test(`${openapi} system.not unknown: a oneOf whose members have a not parses, each member with its not`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { not: 'unknown' } })
    const quickAction = toSchema('QuickAction')
    const members = quickAction?.type === 'union' ? quickAction.members : []

    // The trap: these are the 9 `browser-run quick-action` bodies, which strict removes.
    assertEquals(members.map(member => member.isRef() ? undefined : member.type), ['object', 'object'])
    assertEquals(members.map(member => toNot(member)?.type), ['unknown', 'unknown'])
    assertEquals(errorsAt('QuickAction'), 0)
  })

  Deno.test(`${openapi} system.not unknown: an allOf member's not is kept by the merge`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { not: 'unknown' } })
    const withWait = toSchema('WithWait')

    assertEquals(withWait?.type === 'object' ? Object.keys(withWait.properties ?? {}) : undefined, ['url', 'html', 'wait'])
    assertEquals(toNot(withWait)?.type, 'unknown')
    assertEquals(errorsAt('WithWait'), 0)
  })

  Deno.test(`${openapi} system.not unknown: a schema that is only a not is unknown`, () => {
    const { toSchema } = parse({ openapi, system: { not: 'unknown' } })
    const anything = toSchema('AnythingButAString')

    assertEquals(anything?.type, 'unknown')
    assertEquals(toNot(anything)?.type, 'unknown')
  })

  Deno.test(`${openapi} system.not unknown: a not next to a reference is kept, on an intersection of it`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: { not: 'unknown' } })

    for (const name of ['NamedButNotEmpty', 'NamedAnyOf', 'Tree']) {
      const schema = name === 'Tree' ? toProperty(toSchema('Tree'), 'parent') : toSchema(name)

      // The trap: each parses to a reference, which has no field for the not.
      assertEquals(schema?.isRef(), false, name)
      assertEquals(toNot(schema)?.type, 'unknown', name)
      assertEquals(errorsAt(name), 0)

      const intersection = schema?.isRef() === false && schema.type === 'intersection' ? schema : undefined
      const [member] = intersection?.members ?? []

      assertEquals(intersection?.members.length, 1, name)
      assertEquals(member?.isRef() && member.$ref, `#/components/schemas/${name === 'Tree' ? 'Tree' : 'Named'}`)
      // The trap: null is valid only when the intersection says so.
      assertEquals(intersection?.nullable, name === 'NamedButNotEmpty' ? undefined : true, name)
      assertEquals(intersection?.description, name === 'NamedButNotEmpty' ? 'd' : undefined, name)
    }
  })

  Deno.test(`${openapi} with no system settings, a schema with not fails and is removed, as before`, () => {
    const { toSchema, errorsAt } = parse({ openapi, system: undefined })

    // The trap: strict is the default, so an unconfigured project parses as it always has.
    assertEquals(toSchema('OnlyUrl'), undefined)
    assertEquals(toSchema('QuickAction'), undefined)
    assertEquals(errorsAt('OnlyUrl'), 1)
    assertEquals(toSchema('Named')?.type, 'object')
  })
}
