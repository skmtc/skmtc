import { assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toRefName } from '@/helpers/refFns.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const document = {
  openapi: '3.1.0',
  info: { title: 'Resolve copies', version: '1' },
  paths: {},
  components: {
    schemas: {
      Obj: { type: 'object', description: 'An object.', properties: { a: { type: 'string' } } },
      Str: { type: 'string', maxLength: 10 },
      NullableStr: { type: ['string', 'null'] },
      Site: {
        type: 'object',
        properties: {
          // A keyword the target's type does not take.
          unfit: { allOf: [ref('Obj')], maxLength: 3 },
          // `nullable` on a target that is already nullable.
          alreadyNullable: { anyOf: [ref('NullableStr'), { type: 'null' }] },
          // A keyword with the target's own value.
          sameDescription: { ...ref('Obj'), description: 'An object.' },
          sameMaxLength: { ...ref('Str'), maxLength: 10 },
          // `readOnly: false` beside a target without it.
          notReadOnly: { allOf: [ref('Obj')], readOnly: false },
          // Keywords that do change the target.
          shorter: { ...ref('Str'), maxLength: 3 },
          described: { ...ref('Obj'), description: 'Another description.' }
        }
      }
    }
  }
  // A 3.1 type list is not in the 3.0 types.
} as unknown as OpenAPIV3.Document

const parse = () => {
  const parsed = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))
  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined
  const toSchema = (name: string) => schemas?.[toRefName(`#/components/schemas/${name}`)]
  const site = toSchema('Site')
  const properties = site?.type === 'object' ? (site.properties ?? {}) : {}

  const toSite = (name: string): OasRef<'schema'> => {
    const property = properties[name]

    if (property === undefined || !property.isRef()) {
      throw new Error(`${name} is not a reference`)
    }

    return property
  }

  return { toSchema, toSite }
}

Deno.test('resolve() returns the shared model when the keywords beside the reference change nothing', () => {
  const { toSchema, toSite } = parse()

  assertStrictEquals(toSite('unfit').resolve(), toSchema('Obj'))
  assertStrictEquals(toSite('alreadyNullable').resolve(), toSchema('NullableStr'))
  assertStrictEquals(toSite('sameDescription').resolve(), toSchema('Obj'))
  assertStrictEquals(toSite('sameMaxLength').resolve(), toSchema('Str'))
  assertStrictEquals(toSite('notReadOnly').resolve(), toSchema('Obj'))
})

Deno.test('resolve() returns a copy when a keyword beside the reference changes the model', () => {
  const { toSchema, toSite } = parse()
  const shorter = toSite('shorter').resolve()
  const described = toSite('described').resolve()

  assertNotStrictEquals(shorter, toSchema('Str'))
  assertEquals(shorter.type === 'string' ? shorter.maxLength : undefined, 3)
  assertEquals(described.description, 'Another description.')
})

Deno.test('resolve() keeps its copy and returns it on every call', () => {
  const { toSite } = parse()
  const shorter = toSite('shorter')

  assertStrictEquals(shorter.resolve(), shorter.resolve())
})

Deno.test('hasValueSiblings() is false when a value keyword has the model value', () => {
  const { toSite } = parse()

  assertEquals(toSite('sameMaxLength').hasValueSiblings(), false)
  assertEquals(toSite('shorter').hasValueSiblings(), true)
  // A description changes how the site is described, not which values it accepts.
  assertEquals(toSite('described').hasValueSiblings(), false)
})
