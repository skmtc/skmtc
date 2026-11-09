import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { isReadOnly } from '@/oas/schema/isReadOnly.ts'
import { toRefName } from '@/helpers/refFns.ts'

const document = {
  openapi: '3.0.3',
  info: { title: 'Read-only', version: '1' },
  paths: {},
  components: {
    schemas: {
      Timestamp: { type: 'string', format: 'date-time' },
      Id: { type: 'string', readOnly: true },
      Policy: {
        type: 'object',
        properties: {
          // Read-only at this site only: the 3.0 idiom.
          created_at: { allOf: [{ $ref: '#/components/schemas/Timestamp' }], readOnly: true },
          // Read-only where the reference points.
          id: { $ref: '#/components/schemas/Id' },
          // Read-only on the property itself.
          etag: { type: 'string', readOnly: true },
          name: { type: 'string' },
          updated_at: { $ref: '#/components/schemas/Timestamp' }
        }
      }
    }
  }
} as OpenAPIV3.Document

const policy = () => {
  const parsed = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))
  const schema = parsed.type === 'oas' ? parsed.value.components?.schemas?.[toRefName('#/components/schemas/Policy')] : undefined

  if (!(schema instanceof OasObject) || !schema.properties) {
    throw new Error('Policy did not parse to an object')
  }

  return schema.properties
}

Deno.test('isReadOnly reads readOnly on the reference, where it points, or on the property', () => {
  const properties = policy()

  assertEquals(isReadOnly(properties.created_at), true)
  assertEquals(isReadOnly(properties.id), true)
  assertEquals(isReadOnly(properties.etag), true)
  // The trap: the shared Timestamp model is not read-only; only the site that says so is.
  assertEquals(isReadOnly(properties.updated_at), false)
  assertEquals(isReadOnly(properties.name), false)
})
