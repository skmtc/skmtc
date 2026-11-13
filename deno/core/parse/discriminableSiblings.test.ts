import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toRefName } from '@/helpers/refFns.ts'

const base = { $ref: '#/components/schemas/Base' }

/** A member written as a reference with the discriminator property next to it. */
const member = (kind: string) => ({
  allOf: [base],
  properties: { kind: { type: 'string', enum: [kind] } },
  required: ['kind']
})

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Discriminable', version: '1' },
    paths: {},
    components: {
      schemas: {
        Base: { type: 'object', properties: { name: { type: 'string' } } },
        // Each parses to a reference to `Base` with `properties` and `required` next to it.
        Cat: member('cat'),
        Dog: member('dog'),
        Pet: {
          oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }],
          discriminator: { propertyName: 'kind' }
        }
      }
    }
  }) as OpenAPIV3.Document

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi} isDiscriminable reads the keywords next to a member's reference`, () => {
    const context = new ParseContext({
      input: { type: 'oas', value: toDocument(openapi) },
      logger: new log.Logger('test', 'ERROR'),
      silent: true
    })
    const parsed = context.parse(new StackTrail(['TEST']))
    const pet =
      parsed.type === 'oas'
        ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Pet')]
        : undefined

    // The trap: `Base` alone has no `kind`; the members' own keywords make them discriminable.
    assertEquals(pet?.type === 'union' ? pet.isDiscriminable() : 'not a union', true)
  })
}
