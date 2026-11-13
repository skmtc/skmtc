import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toRefName } from '@/helpers/refFns.ts'

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Unions', version: '1' },
    paths: {},
    components: {
      schemas: {
        R2: { type: 'object', properties: { bucket: { type: 'string' } } },
        Catalog: { type: 'object', properties: { table: { type: 'string' } } },
        // Cloudflare's pipeline sink: Fern's rename is written after the `oneOf`.
        Sink: {
          type: 'object',
          properties: {
            config: {
              description: 'The sink.',
              oneOf: [{ $ref: '#/components/schemas/R2' }, { $ref: '#/components/schemas/Catalog' }],
              'x-fern-property-name': 'sink-config'
            }
          }
        }
      }
    }
  }) as OpenAPIV3.Document

const parseSink = (openapi: string) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system: undefined
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const sink = parsed.type === 'oas' ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Sink')] : undefined
  const properties = sink?.type === 'object' ? sink.properties : undefined

  return { config: properties?.config }
}

for (const openapi of ['3.0.3', '3.1.0']) {
  Deno.test(`${openapi} an extension next to a oneOf stays on the union, and its $ref members stay references`, () => {
    const { config } = parseSink(openapi)

    // The trap: the extension was merged into each member, which resolved each `$ref` to merge it,
    // and the union had no extension fields.
    assertEquals(config?.type === 'union' ? config.extensionFields : undefined, { 'x-fern-property-name': 'sink-config' })
    assertEquals(
      config?.type === 'union' ? config.members.map(member => (member.isRef() ? member.toRefName() : member.type)) : [],
      ['R2', 'Catalog']
    )
  })
}
