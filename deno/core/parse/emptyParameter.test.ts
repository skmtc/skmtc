import { assertEquals, assertThrows } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import {
  toParameterListV3 as toParameterListV30,
  toParametersV3 as toParametersV30
} from '@/parse/v3-0/parameter/toParameterV3.ts'
import {
  toParameterListV3 as toParameterListV31,
  toParametersV3 as toParametersV31
} from '@/parse/v3-1/parameter/toParameterV3.ts'
import {
  toParameterListV3 as toParameterListV32,
  toParametersV3 as toParametersV32
} from '@/parse/v3-2/parameter/toParameterV3.ts'

// A `{}` or `null` entry in a parameters list or in `components.parameters`
// carries no information: it is left out with one EMPTY_PARAMETER warning at
// its location. Any other entry is parsed as before.

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
  { dialect: '3.0', toParameterListV3: toParameterListV30, toParametersV3: toParametersV30 },
  { dialect: '3.1', toParameterListV3: toParameterListV31, toParametersV3: toParametersV31 },
  { dialect: '3.2', toParameterListV3: toParameterListV32, toParametersV3: toParametersV32 }
]

const header: OpenAPIV3.ParameterObject = {
  name: 'X-Request-ID',
  in: 'header',
  required: true,
  schema: { type: 'string' }
}

// Documents in the wild hold entries the parser's input type does not allow.
const asParameter = (value: unknown): OpenAPIV3.ParameterObject => JSON.parse(JSON.stringify(value))

const emptyParameterWarning = (location: string): Logged => ({
  type: 'EMPTY_PARAMETER',
  level: 'warning',
  message: 'Empty parameter object; skipped',
  location
})

for (const { dialect, toParameterListV3, toParametersV3 } of trees) {
  for (const [label, empty] of [
    ['{}', {}],
    ['null', null]
  ] as const) {
    Deno.test(`${dialect} a ${label} entry in a parameters list is left out with a warning`, () => {
      const { context, toLogged } = toRecordingContext()

      const parameters = toParameterListV3({
        parameters: [asParameter(empty), header],
        stackTrail: new StackTrail(['paths', '/mi', 'parameters']),
        context
      })

      assertEquals(parameters?.length, 1)
      const [parameter] = parameters ?? []
      assertEquals(parameter instanceof OasParameter && parameter.name, 'X-Request-ID')
      assertEquals(toLogged(), [emptyParameterWarning('paths:/mi:parameters:0')])
    })

    Deno.test(`${dialect} a ${label} entry in components.parameters is left out with a warning`, () => {
      const { context, toLogged } = toRecordingContext()

      const parameters = toParametersV3({
        parameters: { Empty: asParameter(empty), RequestId: header },
        stackTrail: new StackTrail(['components', 'parameters']),
        context
      })

      assertEquals(Object.keys(parameters), ['RequestId'])
      assertEquals(toLogged(), [emptyParameterWarning('components:parameters:Empty')])
    })
  }

  Deno.test(`${dialect} a non-empty invalid parameter in a list still throws`, () => {
    const { context, toLogged } = toRecordingContext()

    assertThrows(() =>
      toParameterListV3({
        parameters: [asParameter({ name: 'x' })],
        stackTrail: new StackTrail(['paths', '/mi', 'parameters']),
        context
      })
    )
    assertEquals(toLogged(), [])
  })

  Deno.test(`${dialect} a non-empty invalid entry in components.parameters is still INVALID_PARAMETER`, () => {
    const { context, toLogged } = toRecordingContext()

    const parameters = toParametersV3({
      parameters: { Broken: asParameter({ name: 'x' }) },
      stackTrail: new StackTrail(['components', 'parameters']),
      context
    })

    assertEquals(parameters, {})
    assertEquals(
      toLogged().map(({ type, level, location }) => ({ type, level, location })),
      [{ type: 'INVALID_PARAMETER', level: 'error', location: 'components:parameters:Broken' }]
    )
  })
}
