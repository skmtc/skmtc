import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { SystemSettings } from '@/types/Settings.ts'
import { toRefName } from '@/helpers/refFns.ts'

// Cloudflare's envelopes: the common response says `success` is true, an error response that it is false.
const document = {
  openapi: '3.0.3',
  info: { title: 'Envelopes', version: '1' },
  paths: {},
  components: {
    schemas: {
      Common: { type: 'object', properties: { success: { type: 'boolean', enum: [true] } } },
      Failure: {
        allOf: [
          { $ref: '#/components/schemas/Common' },
          { type: 'object', properties: { success: { type: 'boolean', enum: [false] } } }
        ]
      }
    }
  }
} as OpenAPIV3.Document

const parse = (system: SystemSettings | undefined) => {
  const context = new ParseContext({
    input: { type: 'oas', value: document },
    logger: new log.Logger('test', 'ERROR'),
    silent: true,
    system
  })
  const parsed = context.parse(new StackTrail(['TEST']))
  const schemas = parsed.type === 'oas' ? parsed.value.components?.schemas : undefined

  return { failure: schemas?.[toRefName('#/components/schemas/Failure')], issues: context.issues.map(({ level, type, message }) => ({ level, type, message })) }
}

Deno.test('system.allOf latestWins: a schema whose members contradict parses, with one warning naming the keywords', () => {
  const { failure, issues } = parse({ allOf: 'latestWins' })
  const success = failure?.type === 'object' ? failure.properties?.success : undefined

  assertEquals(success?.type === 'boolean' ? success.enums : undefined, [false])
  assertEquals(issues, [{
    level: 'warning',
    type: 'ALLOF_CONTRADICTION',
    message: "The allOf members contradict on enum; the later member's values are kept (system.allOf is latestWins)."
  }])
})

Deno.test('with no system settings, a schema whose members contradict fails and is removed, as before', () => {
  const { failure, issues } = parse(undefined)

  // The trap: strict is the default, so an unconfigured project parses as it always has.
  assertEquals(failure, undefined)
  assertEquals(issues.some(({ level, type }) => level === 'error' && type === 'INVALID_SCHEMA'), true)
  assertEquals(issues.some(({ type }) => type === 'ALLOF_CONTRADICTION'), false)
})
