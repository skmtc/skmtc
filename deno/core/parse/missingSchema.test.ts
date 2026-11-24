import { assert, assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasHeader } from '@/oas/header/Header.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import { toParameterListV3 as toParameterListV30 } from '@/parse/v3-0/parameter/toParameterV3.ts'
import { toParameterListV3 as toParameterListV31 } from '@/parse/v3-1/parameter/toParameterV3.ts'
import { toParameterListV3 as toParameterListV32 } from '@/parse/v3-2/parameter/toParameterV3.ts'
import { toHeadersV3 as toHeadersV30 } from '@/parse/v3-0/header/toHeadersV3.ts'
import { toHeadersV3 as toHeadersV31 } from '@/parse/v3-1/header/toHeadersV3.ts'
import { toHeadersV3 as toHeadersV32 } from '@/parse/v3-2/header/toHeadersV3.ts'

// A parameter or header with neither `schema` nor `content` is invalid
// OpenAPI but common. The parser gives it an empty schema `{}` and logs one
// warning that names it.

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
  { dialect: '3.0', toParameterListV3: toParameterListV30, toHeadersV3: toHeadersV30 },
  { dialect: '3.1', toParameterListV3: toParameterListV31, toHeadersV3: toHeadersV31 },
  { dialect: '3.2', toParameterListV3: toParameterListV32, toHeadersV3: toHeadersV32 }
]

/** The parsed form of `{}`: an unknown schema with no keywords. */
const assertIsEmptySchema = (schema: OasSchema | OasRef<'schema'>) => {
  assert(schema instanceof OasUnknown)
  assertEquals(JSON.stringify(schema.toJsonSchema()), '{}')
}

const content: OpenAPIV3.ParameterObject['content'] = {
  'application/json': { schema: { type: 'string' } }
}

for (const { dialect, toParameterListV3, toHeadersV3 } of trees) {
  Deno.test(`${dialect} a parameter with neither schema nor content reads as {} with a warning`, () => {
    const { context, toLogged } = toRecordingContext()

    const [parameter] =
      toParameterListV3({
        parameters: [{ name: 'home_street', in: 'path', required: true }],
        stackTrail: new StackTrail([
          'paths',
          '/home_streets/{home_street}/firms',
          'get',
          'parameters'
        ]),
        context
      }) ?? []

    assert(parameter instanceof OasParameter)
    assertIsEmptySchema(parameter.toSchema())
    assertEquals(toLogged(), [
      {
        type: 'MISSING_PARAMETER_SCHEMA',
        level: 'warning',
        message:
          "Parameter 'home_street' in path has neither schema nor content; read as an empty schema {}",
        location: 'paths:/home_streets/{home_street}/firms:get:parameters:0'
      }
    ])
  })

  Deno.test(`${dialect} a parameter with schema or content logs nothing new`, () => {
    const { context, toLogged } = toRecordingContext()

    const parameters =
      toParameterListV3({
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'string' } },
          { name: 'filter', in: 'query', content }
        ],
        stackTrail: new StackTrail(['paths', '/firms', 'get', 'parameters']),
        context
      }) ?? []

    assertEquals(
      parameters.map(parameter => parameter.resolve().toSchema() instanceof OasString),
      [true, true]
    )
    assertEquals(toLogged(), [])
  })

  Deno.test(`${dialect} a header with neither schema nor content reads as {} with a warning`, () => {
    const { context, toLogged } = toRecordingContext()

    const headers = toHeadersV3({
      headers: { 'X-Rate-Limit': { description: 'Requests left' } },
      stackTrail: new StackTrail(['paths', '/firms', 'get', 'responses', '200', 'headers']),
      context
    })

    const header = headers?.['X-Rate-Limit']

    assert(header instanceof OasHeader)
    assertIsEmptySchema(header.toSchema())
    assertEquals(toLogged(), [
      {
        type: 'MISSING_HEADER_SCHEMA',
        level: 'warning',
        message: "Header 'X-Rate-Limit' has neither schema nor content; read as an empty schema {}",
        location: 'paths:/firms:get:responses:200:headers:X-Rate-Limit'
      }
    ])
  })

  Deno.test(`${dialect} a header with schema or content logs nothing new`, () => {
    const { context, toLogged } = toRecordingContext()

    const headers = toHeadersV3({
      headers: { 'X-Schema': { schema: { type: 'string' } }, 'X-Content': { content } },
      stackTrail: new StackTrail(['paths', '/firms', 'get', 'responses', '200', 'headers']),
      context
    })

    assertEquals(
      Object.values(headers ?? {}).map(header => header.resolve().toSchema() instanceof OasString),
      [true, true]
    )
    assertEquals(toLogged(), [])
  })
}
