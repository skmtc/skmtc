import { assert, assertEquals, assertThrows } from '@std/assert'
import { fromFileUrl } from '@std/path'
import { convertObj } from './converter.ts'
import { validateSync, ValidationError } from './validate.ts'
import { type JsonValue, toJson } from './json.ts'
import type { ValidateOptions } from './types.ts'

const readFixture = async (name: string): Promise<JsonValue> => {
  const path = fromFileUrl(new URL(`./fixtures/${name}`, import.meta.url))
  return toJson(JSON.parse(await Deno.readTextFile(path)))
}

Deno.test('validateSync - the shipped petstore OpenAPI fixture is valid', async () => {
  const expected = await readFixture('petstore.openapi.json')
  assertEquals(validateSync(expected, {}), true)
})

Deno.test('validateSync - a freshly converted petstore is valid', async () => {
  const swagger = await readFixture('petstore.swagger.json')
  const { openapi } = convertObj(swagger, { origin: 'x' })
  assertEquals(validateSync(openapi, {}), true)
})

Deno.test('validateSync - rejects a swagger 2.0 document', () => {
  assertThrows(
    () => validateSync({ swagger: '2.0', info: { title: 't', version: '1' }, paths: {} }, {}),
    ValidationError
  )
})

Deno.test('validateSync - rejects a missing openapi version', () => {
  assertThrows(
    () => validateSync({ info: { title: 't', version: '1' }, paths: {} }, {}),
    ValidationError,
    'requires an openapi version'
  )
})

Deno.test('validateSync - rejects a path parameter without required:true', () => {
  assertThrows(
    () =>
      validateSync(
        {
          openapi: '3.0.0',
          info: { title: 't', version: '1' },
          paths: {
            '/pets/{id}': {
              get: {
                parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
                responses: { '200': { description: 'ok' } }
              }
            }
          }
        },
        {}
      ),
    ValidationError,
    'required:true'
  )
})

Deno.test('validateSync - lint mode collects violations without aborting', () => {
  const options: ValidateOptions = { lint: true }
  const valid = validateSync(
    {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/pets': {
          get: {
            // no operationId, summary/description, or tags -> several lint rules fire
            responses: { '200': { description: 'ok' } }
          }
        }
      }
    },
    options
  )
  assertEquals(valid, true)
  assert((options.violations ?? []).length > 0, 'expected lint violations to be collected')
  const ruleNames = (options.violations ?? []).map(v => v.rule)
  assert(ruleNames.includes('operation-operationId'), 'expected operationId rule violation')
})

Deno.test('validateSync - carries JSON-Pointer context on failure', () => {
  const error = assertThrows(
    () =>
      validateSync(
        {
          openapi: '3.0.0',
          info: { title: 't', version: '1' },
          paths: {
            '/pets': {
              get: {
                parameters: [{ name: 'q', in: 'invalid-location', schema: { type: 'string' } }],
                responses: { '200': { description: 'ok' } }
              }
            }
          }
        },
        {}
      ),
    ValidationError
  )
  assert(error instanceof ValidationError)
  assert(error.context.length > 0, 'expected a non-empty context stack')
})
