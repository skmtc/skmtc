import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toRefName } from '@/helpers/refFns.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

const named = { $ref: '#/components/schemas/Named' }
// 3.0's way to write null, as Cloudflare's `workers_deployment.code_update_strategy` writes it.
const nullMember = { enum: [null], nullable: true, type: 'object' }

const toDocument = (openapi: string) =>
  ({
    openapi,
    info: { title: 'Null member', version: '1' },
    paths: {},
    components: {
      schemas: {
        Named: { type: 'object', properties: { id: { type: 'string' } } },
        OneOfNamed: { oneOf: [named, nullMember] },
        AnyOfNamed: { anyOf: [named, nullMember] },
        OneOfStrings: { oneOf: [{ type: 'string' }, { type: 'integer' }, nullMember] }
      }
    }
  }) as OpenAPIV3.Document

const parse = (openapi: string) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocument(openapi) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined

  return (name: string): OasSchema | OasRef<'schema'> | undefined =>
    schemas?.[toRefName(`#/components/schemas/${name}`)]
}

for (const openapi of ['3.0.3', '3.1.0', '3.2.0']) {
  Deno.test(`${openapi}: a oneOf or anyOf of a reference and 3.0's null is a nullable reference`, () => {
    const toSchema = parse(openapi)

    for (const name of ['OneOfNamed', 'AnyOfNamed']) {
      const schema = toSchema(name)

      // The trap: the null member became an `unknown` member of a union.
      assertEquals(schema?.isRef(), true, name)
      assertEquals(schema?.isRef() ? schema.nullable : undefined, true, name)
    }
  })

  Deno.test(`${openapi}: 3.0's null member makes a union of several members nullable`, () => {
    const strings = parse(openapi)('OneOfStrings')
    const members = strings?.type === 'union' ? strings.members : []

    assertEquals(members.map(member => (member.isRef() ? 'ref' : member.type)), ['string', 'integer'])
    assertEquals(strings?.type === 'union' ? strings.nullable : undefined, true)
  })
}
