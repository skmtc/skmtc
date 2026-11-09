import { assertEquals, assertStrictEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { CustomValue } from '@/dsl/CustomValue.ts'
import { toRefName } from '@/helpers/refFns.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const document = {
  openapi: '3.0.3',
  info: { title: 'Siblings', version: '1' },
  paths: {},
  components: {
    schemas: {
      Name: { type: 'string', description: 'A name.' },
      Short: { allOf: [ref('Name')], maxLength: 10 },
      Tags: { type: 'array', items: { type: 'string' } },
      Base: { type: 'object', required: ['a'], properties: { a: { type: 'string' } } },
      Pet: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
      Node: {
        type: 'object',
        properties: {
          // A self-reference with keywords next to it: parsing must end.
          next: { allOf: [ref('Node')], description: 'The next node.', deprecated: true }
        }
      },
      Site: {
        type: 'object',
        properties: {
          title: { allOf: [ref('Name')], minLength: 3, description: 'The title.', 'x-fern-property-name': 'heading' },
          tags: { allOf: [ref('Tags')], minItems: 1 },
          base: { allOf: [ref('Base')], required: ['b'], properties: { b: { type: 'integer' } } },
          pet: { allOf: [ref('Pet')], description: 'A pet.' },
          short: { allOf: [ref('Short')], minLength: 2 },
          plain: ref('Name'),
          flagged: { allOf: [ref('Name')], nullable: true }
        }
      }
    }
  }
} as OpenAPIV3.Document

const parse = () => {
  const parsed = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))

  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined
  const toObject = (name: string): OasObject => {
    const schema = schemas?.[toRefName(`#/components/schemas/${name}`)]

    if (!(schema instanceof OasObject) || !schema.properties) {
      throw new Error(`${name} did not parse to an object`)
    }

    return schema
  }

  return { site: toObject('Site').properties ?? {}, node: toObject('Node') }
}

/** The schema at a property's site. */
const atSite = (property: OasSchema | OasRef<'schema'> | CustomValue | undefined): OasSchema => {
  if (property === undefined || !property.isRef()) {
    throw new Error('expected a reference')
  }

  return property.resolveWithSiblings()
}

Deno.test('resolveWithSiblings() applies the keywords next to a reference to a copy of the target', () => {
  const { site } = parse()
  const title = atSite(site.title)

  assertEquals(title.type, 'string')
  assertEquals(title.type === 'string' ? title.minLength : undefined, 3)
  assertEquals(title.description, 'The title.')
  assertEquals(title.extensionFields?.['x-fern-property-name'], 'heading')

  // The trap: the shared Name is not changed by one site's keywords.
  const name = atSite(site.plain)
  assertEquals(name.type === 'string' ? [name.minLength, name.description] : [], [undefined, 'A name.'])
})

Deno.test('object keywords add properties and required names; array keywords keep the items', () => {
  const { site } = parse()
  const base = atSite(site.base)
  const tags = atSite(site.tags)

  assertEquals(base.type === 'object' ? Object.keys(base.properties ?? {}) : [], ['a', 'b'])
  assertEquals(base.type === 'object' ? base.required : [], ['a', 'b'])
  assertEquals(tags.type === 'array' ? [tags.minItems, tags.items.type] : [], [1, 'string'])
})

Deno.test('keywords next to a union, and along a chain of references, apply too', () => {
  const { site } = parse()
  const pet = atSite(site.pet)
  const short = atSite(site.short)

  assertEquals([pet.type, pet.description], ['union', 'A pet.'])
  // Short is itself Name with maxLength 10; this site adds minLength 2.
  assertEquals(short.type === 'string' ? [short.minLength, short.maxLength] : [], [2, 10])
})

Deno.test('a self-reference with keywords parses, and its copy shares the target properties', () => {
  const { node } = parse()
  const next = node.properties?.next
  const copy = atSite(next)

  assertEquals(copy.description, 'The next node.')
  assertEquals(copy.type === 'object' ? copy.deprecated : undefined, true)
  // No new reference is made, so following it again ends where it began.
  assertStrictEquals(copy.type === 'object' ? copy.properties?.next : undefined, next)
})

Deno.test('a reference with no keywords next to it resolves to the shared instance itself', () => {
  const { site } = parse()

  assertStrictEquals(atSite(site.plain), site.plain?.resolve())
  // Use-site flags alone are no siblings.
  const flagged = site.flagged

  assertEquals(flagged?.isRef() ? [flagged.nullable, flagged.siblings] : [], [true, undefined])
})
