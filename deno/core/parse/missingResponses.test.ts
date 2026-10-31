import { assertEquals, assertMatch } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOperationsV3 as toOperationsV30 } from '@/parse/v3-0/operation/toOperationsV3.ts'
import { toOperationsV3 as toOperationsV31 } from '@/parse/v3-1/operation/toOperationsV3.ts'
import { toOperationsV3 as toOperationsV32 } from '@/parse/v3-2/operation/toOperationsV3.ts'
import { toWebhooksV3 as toWebhooksV30 } from '@/parse/v3-0/webhook/toWebhooksV3.ts'
import { toWebhooksV3 as toWebhooksV31 } from '@/parse/v3-1/webhook/toWebhooksV3.ts'
import { toWebhooksV3 as toWebhooksV32 } from '@/parse/v3-2/webhook/toWebhooksV3.ts'

// An operation or webhook without `responses` is kept, reads as no
// documented responses and logs one MISSING_RESPONSES warning. A `responses`
// that is not an object drops the operation as INVALID_OPERATION.

type Logged = { type: string; level: string; message: string; location: string }

const toRecordingContext = () => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: { openapi: '3.0.0', info: { title: 't', version: '0' }, paths: {} }
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  const toLogged = (): Logged[] =>
    context.issues.map(({ type, level, message, location }) => ({ type, level, message, location }))

  return { context, toLogged }
}

const trees = [
  { dialect: '3.0', toOperationsV3: toOperationsV30, toWebhooksV3: toWebhooksV30 },
  { dialect: '3.1', toOperationsV3: toOperationsV31, toWebhooksV3: toWebhooksV31 },
  { dialect: '3.2', toOperationsV3: toOperationsV32, toWebhooksV3: toWebhooksV32 }
]

// `responses` is required by the parser's input type; these documents leave
// it out or give it the wrong type on purpose.
const withResponses = (responses: unknown): OpenAPIV3.OperationObject =>
  JSON.parse(JSON.stringify({ operationId: 'createPet', responses }))

const withoutResponses = (): OpenAPIV3.OperationObject => JSON.parse('{"operationId":"createPet"}')

const missingResponsesWarning = (location: string): Logged => ({
  type: 'MISSING_RESPONSES',
  level: 'warning',
  message: 'Operation has no responses; read as no documented responses',
  location
})

for (const { dialect, toOperationsV3, toWebhooksV3 } of trees) {
  const parseOperation = (operation: OpenAPIV3.OperationObject) => {
    const { context, toLogged } = toRecordingContext()
    const operations = toOperationsV3({
      paths: { '/pets': { post: operation } },
      stackTrail: new StackTrail(['paths']),
      context
    })

    return { operations, logged: toLogged() }
  }

  const parseWebhook = (operation: OpenAPIV3.OperationObject) => {
    const { context, toLogged } = toRecordingContext()
    const webhooks = toWebhooksV3({
      webhooks: { newPet: { post: operation } },
      stackTrail: new StackTrail(['webhooks']),
      context
    })

    return { webhooks, logged: toLogged() }
  }

  Deno.test(`${dialect} operation without responses parses with {} and one warning`, () => {
    const { operations, logged } = parseOperation(withoutResponses())

    assertEquals(operations.length, 1)
    assertEquals(operations[0].responses, {})
    assertEquals(logged, [missingResponsesWarning('paths:/pets:post:responses')])
  })

  Deno.test(`${dialect} operation with responses: null parses with {} and one warning`, () => {
    const { operations, logged } = parseOperation(withResponses(null))

    assertEquals(operations.length, 1)
    assertEquals(operations[0].responses, {})
    assertEquals(logged, [missingResponsesWarning('paths:/pets:post:responses')])
  })

  Deno.test(`${dialect} operation with responses: {} logs nothing`, () => {
    const { operations, logged } = parseOperation(withResponses({}))

    assertEquals(operations.length, 1)
    assertEquals(operations[0].responses, {})
    assertEquals(logged, [])
  })

  for (const [label, responses, actual] of [
    ['[]', [], 'an array'],
    ['"x"', 'x', 'string']
  ] as const) {
    Deno.test(`${dialect} operation with responses: ${label} is dropped as INVALID_OPERATION`, () => {
      const { operations, logged } = parseOperation(withResponses(responses))

      assertEquals(operations, [])
      assertEquals(logged.length, 1)
      assertEquals(logged[0].type, 'INVALID_OPERATION')
      assertEquals(logged[0].level, 'error')
      assertMatch(logged[0].message, /"responses"/)
      assertMatch(logged[0].message, new RegExp(`got ${actual}$`))
    })
  }

  Deno.test(`${dialect} webhook without responses parses with {} and one warning`, () => {
    const { webhooks, logged } = parseWebhook(withoutResponses())

    assertEquals(webhooks.length, 1)
    assertEquals(webhooks[0].responses, {})
    assertEquals(logged, [missingResponsesWarning('webhooks:newPet:post:responses')])
  })

  Deno.test(`${dialect} webhook with responses: null parses with {} and one warning`, () => {
    const { webhooks, logged } = parseWebhook(withResponses(null))

    assertEquals(webhooks.length, 1)
    assertEquals(webhooks[0].responses, {})
    assertEquals(logged, [missingResponsesWarning('webhooks:newPet:post:responses')])
  })
}
