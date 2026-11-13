import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toRefName } from '@/helpers/refFns.ts'

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Bare references', version: '1' },
    paths: {},
    components: {
      schemas: {
        Name: { type: 'string' },
        Base: { type: 'object', properties: { a: { type: 'string' } } },
        Extra: { type: 'object', properties: { b: { type: 'string' } } },
        Site: {
          type: 'object',
          properties: {
            // Keywords written directly beside the reference, with no allOf around it.
            bare: { $ref: '#/components/schemas/Name', description: 'A short name.', maxLength: 3 },
            // An allOf beside the reference: both apply.
            both: {
              $ref: '#/components/schemas/Base',
              allOf: [{ $ref: '#/components/schemas/Extra' }]
            },
            // An allOf that is not an array, beside the reference.
            notArray: { $ref: '#/components/schemas/Name', allOf: 'not an array' }
          }
        }
      }
    }
  }) as unknown as OpenAPIV3.Document

const parseBare = (openapi: string) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const site =
    parsed.type === 'oas'
      ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Site')]
      : undefined
  const bare = site?.type === 'object' ? site.properties?.bare : undefined

  if (bare === undefined || !bare.isRef()) {
    throw new Error('bare did not parse to a reference')
  }

  const resolved = bare.resolve()

  return {
    description: resolved.description,
    maxLength: resolved.type === 'string' ? resolved.maxLength : undefined,
    unexpected: context.issues.filter(
      ({ type, location }) => type === 'UNEXPECTED_PROPERTY' && location.includes('bare')
    ).length
  }
}

Deno.test('3.0: keywords beside a bare $ref are ignored, as the 3.0 spec says, and reported', () => {
  assertEquals(parseBare('3.0.3'), { description: undefined, maxLength: undefined, unexpected: 2 })
})

for (const openapi of ['3.1.0', '3.2.0']) {
  Deno.test(`${openapi}: keywords beside a bare $ref apply, as in JSON Schema 2020-12`, () => {
    assertEquals(parseBare(openapi), { description: 'A short name.', maxLength: 3, unexpected: 0 })
  })

  Deno.test(`${openapi}: an allOf beside a bare $ref keeps the reference`, () => {
    const context = new ParseContext({
      input: { type: 'oas', value: toDocument(openapi) },
      logger: new log.Logger('test', 'ERROR'),
      silent: true
    })
    const parsed = context.parse(new StackTrail(['TEST']))
    const site =
      parsed.type === 'oas'
        ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Site')]
        : undefined
    const both = site?.type === 'object' ? site.properties?.both : undefined
    const resolved = both?.isRef() ? both.resolve() : both

    // The trap: the spread replaced `allOf: [{ $ref: Base }]`, and only Extra was left.
    assertEquals(
      resolved?.type === 'object' ? Object.keys(resolved.properties ?? {}).toSorted() : resolved?.type,
      ['a', 'b']
    )
  })

  Deno.test(`${openapi}: an allOf beside a bare $ref that is not an array is reported, and the reference kept`, () => {
    const context = new ParseContext({
      input: { type: 'oas', value: toDocument(openapi) },
      logger: new log.Logger('test', 'ERROR'),
      silent: true
    })
    const parsed = context.parse(new StackTrail(['TEST']))
    const site =
      parsed.type === 'oas'
        ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Site')]
        : undefined
    const notArray = site?.type === 'object' ? site.properties?.notArray : undefined

    assertEquals(notArray?.isRef() ? notArray.toRefName() : notArray?.type, 'Name')
    // The trap: the allOf was replaced by `[{ $ref }]` with no warning.
    assertEquals(
      context.issues
        .filter(
          ({ type, location }) => type === 'UNEXPECTED_PROPERTY' && location.includes('notArray')
        )
        .map(({ location }) => location.split(':').at(-1)),
      ['allOf']
    )
  })
}
