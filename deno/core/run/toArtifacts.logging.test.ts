import { assertEquals } from '@std/assert'
import { stub } from '@std/testing/mock'
import * as log from '@std/log'
import { stripAnsiCode } from '@std/fmt/colors'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

const ok = { responses: { '200': { description: 'ok' } } }

const document = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: { '/pets': { get: ok }, '/users': { get: ok } }
  },
  'logging document'
)

/** `ops` warns through `context.logger` while it transforms `GET /pets`. */
const warningGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
  ops: toOasOperationEntry({
    id: 'ops',
    transform: ({ context, operation }) => {
      if (operation.path === '/pets') {
        context.logger.warn('could not collate example')
      }
    }
  })
})

const runWith = (
  toGeneratorConfigMap: <E = undefined>() => GeneratorsMapContainer<E>,
  silent = true
) =>
  toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: document },
    settings: undefined,
    toGeneratorConfigMap,
    startAt: Date.now(),
    silent,
    stackTrail: new StackTrail(['TEST'])
  })

/** Runs `fn` and returns what it printed with `console.log`. */
const captureConsole = <T>(fn: () => T): { value: T; printed: string[] } => {
  const printed: string[] = []
  const consoleStub = stub(console, 'log', (...args: unknown[]) => {
    printed.push(args.map(String).join(' '))
  })

  try {
    return { value: fn(), printed }
  } finally {
    consoleStub.restore()
  }
}

Deno.test('toArtifacts - a warning logged in a transform prints the subject trail', () => {
  const { printed } = captureConsole(() => runWith(warningGenerators))

  const warning = printed.find(line => line.includes('could not collate example'))

  assertEquals(
    stripAnsiCode(warning ?? '').includes('Stack: TEST:generate:ops:/pets:get:variant:main'),
    true
  )
})

Deno.test('toArtifacts - a warning logged in a transform makes the result a warning', () => {
  const { value: result } = captureConsole(() => runWith(warningGenerators))

  assertEquals(result.manifest.results, {
    TEST: {
      generate: {
        ops: {
          '/pets': { get: { variant: { main: 'warning' } } },
          '/users': { get: { variant: { main: 'success' } } }
        }
      }
    }
  })
})

Deno.test('toArtifacts - a line logged outside a subject has no trail and no result', () => {
  // `minLength` must be a number: the parse error is logged during parse.
  const badDocument = toDocumentObject(
    {
      openapi: '3.1.0',
      info: { title: 't', version: '0' },
      paths: {},
      components: { schemas: { A: { type: 'string', minLength: 'oops' } } }
    },
    'parse error document'
  )

  const { value: result, printed } = captureConsole(() =>
    toArtifacts({
      traceId: 'trace',
      spanId: 'span',
      document: { type: 'oas', value: badDocument },
      settings: undefined,
      toGeneratorConfigMap: warningGenerators,
      startAt: Date.now(),
      silent: false,
      stackTrail: new StackTrail(['TEST'])
    })
  )

  const parseLine = printed.find(line => line.includes('INVALID_SCHEMA'))

  assertEquals(parseLine === undefined, false)
  assertEquals(stripAnsiCode(parseLine ?? '').includes('Stack:'), false)
  assertEquals(result.manifest.results, {})
})

Deno.test('toArtifacts - a host logger keeps its handlers', () => {
  const hostHandler = new log.ConsoleHandler('DEBUG')

  log.setup({
    handlers: { host: hostHandler },
    loggers: { host: { level: 'DEBUG', handlers: ['host'] } }
  })

  try {
    captureConsole(() => runWith(warningGenerators))

    assertEquals(log.getLogger('host').handlers, [hostHandler])
  } finally {
    log.setup({ handlers: {}, loggers: {} })
  }
})
