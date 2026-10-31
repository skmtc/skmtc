import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { toInfoV3 as toInfoV30 } from '@/parse/v3-0/info/toInfoV3.ts'
import { toInfoV3 as toInfoV31 } from '@/parse/v3-1/info/toInfoV3.ts'
import { toInfoV3 as toInfoV32 } from '@/parse/v3-2/info/toInfoV3.ts'

// A document whose `info` is missing, `null` or not an object reads as an
// empty title and version with one MISSING_INFO warning. A `title` or
// `version` that is not a string reads as '' with one warning each.

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
  { dialect: '3.0', toInfoV3: toInfoV30 },
  { dialect: '3.1', toInfoV3: toInfoV31 },
  { dialect: '3.2', toInfoV3: toInfoV32 }
]

// `info` is typed as an Info Object; these documents give it other shapes
// on purpose.
const asInfo = (info: unknown): OpenAPIV3.InfoObject | null | undefined =>
  info === undefined ? undefined : JSON.parse(JSON.stringify(info))

const missingInfo: Logged = {
  type: 'MISSING_INFO',
  level: 'warning',
  message: 'Document has no info object; read as empty title and version',
  location: 'info'
}

const missingField = (field: 'title' | 'version'): Logged => ({
  type: 'MISSING_INFO',
  level: 'warning',
  message: `Info has no string ${field}; read as ''`,
  location: `info:${field}`
})

for (const { dialect, toInfoV3 } of trees) {
  const parseInfo = (info: unknown) => {
    const { context, toLogged } = toRecordingContext()
    const parsed = toInfoV3({ info: asInfo(info), stackTrail: new StackTrail(['info']), context })

    return { parsed, logged: toLogged() }
  }

  for (const [label, info] of [
    ['missing', undefined],
    ['null', null],
    ['an array', []],
    ['a string', 'x']
  ] as const) {
    Deno.test(`${dialect} info ${label} reads as empty title and version with one warning`, () => {
      const { parsed, logged } = parseInfo(info)

      assertEquals(parsed, new OasInfo({ title: '', version: '' }))
      assertEquals(logged, [missingInfo])
    })
  }

  Deno.test(`${dialect} info: {} warns for title and version`, () => {
    const { parsed, logged } = parseInfo({})

    assertEquals(parsed.title, '')
    assertEquals(parsed.version, '')
    assertEquals(logged, [missingField('title'), missingField('version')])
  })

  Deno.test(`${dialect} info: { title: 1 } warns for title and version`, () => {
    const { parsed, logged } = parseInfo({ title: 1 })

    assertEquals(parsed.title, '')
    assertEquals(parsed.version, '')
    assertEquals(logged, [missingField('title'), missingField('version')])
  })

  Deno.test(`${dialect} info: { version: 1.0 } warns for version only`, () => {
    const { parsed, logged } = parseInfo({ title: 't', version: 1.0 })

    assertEquals(parsed.title, 't')
    assertEquals(parsed.version, '')
    assertEquals(logged, [missingField('version')])
  })

  Deno.test(`${dialect} info with string title and version logs nothing`, () => {
    const { parsed, logged } = parseInfo({ title: 't', version: '1', description: 'd' })

    assertEquals(parsed, new OasInfo({ title: 't', version: '1', description: 'd' }))
    assertEquals(logged, [])
  })
}
