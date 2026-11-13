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
        Site: {
          type: 'object',
          properties: {
            // Keywords written directly beside the reference, with no allOf around it.
            bare: { $ref: '#/components/schemas/Name', description: 'A short name.', maxLength: 3 }
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
    unexpected: context.issues.filter(({ type }) => type === 'UNEXPECTED_PROPERTY').length
  }
}

Deno.test('3.0: keywords beside a bare $ref are ignored, as the 3.0 spec says, and reported', () => {
  assertEquals(parseBare('3.0.3'), { description: undefined, maxLength: undefined, unexpected: 2 })
})

for (const openapi of ['3.1.0', '3.2.0']) {
  Deno.test(`${openapi}: keywords beside a bare $ref apply, as in JSON Schema 2020-12`, () => {
    assertEquals(parseBare(openapi), { description: 'A short name.', maxLength: 3, unexpected: 0 })
  })
}
