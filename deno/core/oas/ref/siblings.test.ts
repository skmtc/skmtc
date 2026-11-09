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
          flagged: { allOf: [ref('Name')], nullable: true },
          nick: { allOf: [ref('Name')], nullable: true, readOnly: true, maxLength: 5 },
          letter: { allOf: [ref('Letter')], minLength: 1 },
          longTags: { allOf: [ref('Tags')], minLength: 3 },
          typed: { allOf: [ref('Name')], type: 'integer', minimum: 1 },
          wrongExample: { allOf: [ref('Name')], example: 5, description: 'Still described.' },
          sameType: { allOf: [ref('Name')], type: 'string', minLength: 4 },
          extra: { allOf: [ref('Name')], items: { type: 'string' } },
          // Every member of Animal is an object, so `type: object` agrees.
          animal: { allOf: [ref('Animal')], type: 'object', description: 'An animal.' },
          // Pet has a string member and an integer one, so `type: string` does not.
          narrowPet: { allOf: [ref('Pet')], type: 'string' }
        }
      },
      // No `type`: the parser reads an `enum` of strings as a string.
      Letter: { enum: ['a', 'b'] },
      Cat: { type: 'object', properties: { purrs: { type: 'boolean' } } },
      Animal: { oneOf: [ref('Cat'), { type: 'object', properties: { barks: { type: 'boolean' } } }] }
    }
  }
} as OpenAPIV3.Document

const parse = () => {
  const context = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const parsed = context.parse(new StackTrail(['TEST']))

  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined
  const toObject = (name: string): OasObject => {
    const schema = schemas?.[toRefName(`#/components/schemas/${name}`)]

    if (!(schema instanceof OasObject) || !schema.properties) {
      throw new Error(`${name} did not parse to an object`)
    }

    return schema
  }

  return { site: toObject('Site').properties ?? {}, node: toObject('Node'), issues: context.issues, schemas }
}

/** The schema at a property's site. */
const atSite = (property: OasSchema | OasRef<'schema'> | CustomValue | undefined): OasSchema => {
  if (property === undefined || !property.isRef()) {
    throw new Error('expected a reference')
  }

  return property.resolve()
}

Deno.test('resolve() applies the keywords next to a reference to a copy of the target', () => {
  const { site } = parse()
  const title = atSite(site.title)

  assertEquals(title.type, 'string')
  assertEquals(title.type === 'string' ? title.minLength : undefined, 3)
  assertEquals(title.description, 'The title.')
  assertEquals(title.extensionFields?.['x-fern-property-name'], 'heading')

  // resolveOnce() applies no siblings: it is one step along the chain.
  const once = site.title?.isRef() ? site.title.resolveOnce() : undefined
  assertEquals(once?.type === 'string' ? once.minLength : 'not a string', undefined)

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

Deno.test('a reference with nothing next to it resolves to the shared instance itself', () => {
  const { site } = parse()

  assertStrictEquals(atSite(site.plain), site.plain?.resolve())
})

Deno.test('a use-site flag alone is a sibling: the reference resolves to a copy with it', () => {
  const { site } = parse()
  const flagged = site.flagged
  const copy = atSite(flagged)

  assertEquals(flagged?.isRef() ? flagged.hasSiblings() : undefined, true)
  assertEquals(copy.type === 'string' ? [copy.nullable, copy.description] : [], [true, 'A name.'])
  // The trap: the shared Name does not become nullable.
  assertEquals(atSite(site.plain).nullable, undefined)
  // `nullable` changes values, but a reference renders it by name (`name.nullable()`).
  assertEquals(flagged?.isRef() ? flagged.hasValueSiblings() : undefined, false)
})

Deno.test('OasRef.clone(ref) merges another site\'s keywords over its own, and points at the same target', () => {
  const { site, schemas } = parse()
  // Short is `{ allOf: [Name], maxLength: 10 }`; the site adds minLength 2.
  const short = schemas?.[toRefName('#/components/schemas/Short')]
  const at = site.short

  if (!short?.isRef() || !at?.isRef() || !at.isSchemaRef()) {
    throw new Error('expected references')
  }

  const copy = short.clone(at)

  assertEquals([copy.toRefName(), copy.minLength, copy.maxLength], ['Name', 2, 10])
  const resolved = copy.resolve()
  assertEquals(resolved.type === 'string' ? [resolved.minLength, resolved.maxLength] : [], [2, 10])
  // The trap: Short keeps only its own keyword.
  assertEquals([short.minLength, short.maxLength], [undefined, 10])
})

Deno.test('clone(ref) carries the use-site flags onto the copy at a site with keywords', () => {
  const { site } = parse()
  const nick = atSite(site.nick)

  assertEquals(nick.type === 'string' ? [nick.maxLength, nick.nullable, nick.isReadOnly()] : [], [5, true, true])

  // The trap: the shared Name is neither nullable nor read-only.
  const name = atSite(site.plain)
  assertEquals(name.type === 'string' ? [name.nullable, name.isReadOnly()] : [], [undefined, false])
})

Deno.test('keywords apply to a target the parser types without a `type` keyword', () => {
  // Parsing the keywords used to need the target's `type` from the document,
  // so an `enum` with no `type` lost the `minLength` next to it.
  const { site } = parse()
  const letter = atSite(site.letter)

  assertEquals(letter.type === 'string' ? [letter.minLength, letter.enums] : [], [1, ['a', 'b']])
})

Deno.test('toSkippedSiblings() names what clone leaves out, and the copy goes without it', () => {
  const { site } = parse()
  const skipped = (name: string): string[] => {
    const property = site[name]

    return property?.isRef() ? property.toSkippedSiblings() : ['not a reference']
  }

  assertEquals(skipped('longTags'), ['minLength'])
  assertEquals(skipped('typed'), ['type', 'minimum'])
  assertEquals(skipped('wrongExample'), ['example'])
  assertEquals(skipped('sameType'), [])
  assertEquals(skipped('animal'), [])
  assertEquals(skipped('narrowPet'), ['type'])
  assertEquals(skipped('title'), [])
  assertEquals(skipped('plain'), [])

  const longTags = atSite(site.longTags)
  const wrongExample = atSite(site.wrongExample)

  assertEquals('minLength' in longTags, false)
  assertEquals([wrongExample.example, wrongExample.description], [undefined, 'Still described.'])
})

Deno.test('hasValueSiblings() counts only the keywords the target takes', () => {
  const { site } = parse()
  const changes = (name: string): boolean => {
    const property = site[name]

    return property?.isRef() === true && property.hasValueSiblings()
  }

  assertEquals(changes('title'), true)
  assertEquals(changes('sameType'), true)
  // `minLength` next to an array changes nothing: an array is not a string.
  assertEquals(changes('longTags'), false)
  assertEquals(changes('pet'), false)
  assertEquals(changes('plain'), false)
})

Deno.test('a keyword no schema has next to a reference is reported while parsing', () => {
  const { site, issues } = parse()
  const extra = site.extra

  assertEquals(
    issues.filter(issue => issue.location.includes('extra')).map(issue => issue.message),
    ["Unexpected property 'items' in 'schema:siblings'"]
  )
  // Nothing else is next to it, so the reference resolves to the shared Name.
  assertStrictEquals(atSite(extra), site.plain?.resolve())
})

const document31 = {
  openapi: '3.1.0',
  info: { title: 'Siblings 3.1', version: '1' },
  paths: {},
  components: {
    schemas: {
      MaybeName: { type: ['string', 'null'] },
      Site: { type: 'object', properties: { maybe: { allOf: [ref('MaybeName')], minLength: 3 } } }
    }
  }
  // A 3.1 type list is not in the 3.0 types, as in ParseContext.dialect.test.ts.
} as unknown as OpenAPIV3.Document

Deno.test('keywords apply next to a 3.1 type list', () => {
  // `type: ['string', 'null']` is a nullable string once parsed; read from
  // the document as written, it named no single type, and `minLength` was lost.
  const parsed = new ParseContext({
    input: { type: 'oas', value: document31 },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))
  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined
  const site = schemas?.[toRefName('#/components/schemas/Site')]
  const maybe = atSite(site?.type === 'object' ? site.properties?.maybe : undefined)

  assertEquals(maybe.type === 'string' ? [maybe.minLength, maybe.nullable] : [], [3, true])
})
