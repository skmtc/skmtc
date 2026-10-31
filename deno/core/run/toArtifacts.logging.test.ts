import { assertEquals } from '@std/assert'
import { stub } from '@std/testing/mock'
import * as log from '@std/log'
import { stripAnsiCode } from '@std/fmt/colors'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { emptyEnrichmentSchema, type Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ResultsItem } from '@/types/Results.ts'
import type { LogLine } from '@/types/LogLine.ts'

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

// -- structured `logs` -------------------------------------------------

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) =>
    new MockDefinition({ context, identifier, value }),
  toImport: () => {
    throw new Error('this test registers no cross-file imports')
  },
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

const ModelBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'models',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/models.txt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/** A model that cannot be built for `Broken`. */
class BreakableModel extends ModelBase {
  constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
    super(args)

    if (args.refName === 'Broken') {
      throw new Error('Broken cannot be modeled')
    }
  }

  override toString(): string {
    return this.refName
  }
}

const throwingDocument = toDocumentObject(
  {
    openapi: '3.1.0',
    info: { title: 't', version: '0' },
    paths: { '/pets': { get: ok }, '/users': { get: ok } },
    components: { schemas: { Broken: { type: 'string' }, Fine: { type: 'string' } } }
  },
  'throwing document'
)

/**
 * `ops` throws for `GET /pets` and inserts the `Broken` model as its peer
 * for `GET /users`. `models` builds every model with {@link BreakableModel}.
 */
const throwingGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error see above
  ops: toOasOperationEntry({
    id: 'ops',
    transform: ({ context, operation }) => {
      context.logger.debug(`transforming ${operation.path}`)
      context.logger.info(`transforming ${operation.path}`)

      if (operation.path === '/pets') {
        throw new Error('pets transform failed')
      }

      context.insertModel(BreakableModel, 'Broken' as RefName)
    }
  }),
  // @ts-expect-error see above
  models: toModelEntry({
    id: 'models',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, refName }) => {
      context.insertModel(BreakableModel, refName)
    }
  })
})

const runThrowing = (traceId: string, logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') =>
  toArtifacts({
    traceId,
    spanId: 'span',
    document: { type: 'oas', value: throwingDocument },
    settings: undefined,
    toGeneratorConfigMap: throwingGenerators,
    startAt: Date.now(),
    silent: true,
    logLevel,
    stackTrail: new StackTrail([traceId])
  })

/** The `results` leaf a line's trail addresses, read with own-property lookups. */
const toResultAt = (results: ResultsItem, trail: string): unknown =>
  StackTrail.fromString(trail).stackTrail.reduce<unknown>(
    (node, frame) =>
      typeof node === 'object' && node !== null && Object.hasOwn(node, frame)
        ? Object.getOwnPropertyDescriptor(node, frame)?.value
        : undefined,
    results
  )

const errorLineAt = (logs: LogLine[], trail: string): LogLine | undefined =>
  logs.find(line => line.level === 'ERROR' && line.trail === trail)

Deno.test('toArtifacts - a throwing transform returns an ERROR line joined to its result', () => {
  const { value: result } = captureConsole(() => runThrowing('trace'))

  const line = errorLineAt(result.logs, 'trace:generate:ops:/pets:get:variant:main')

  assertEquals(line?.message, 'pets transform failed')
  assertEquals(line?.error?.name, 'Error')
  assertEquals(line?.error?.message, 'pets transform failed')
  assertEquals(line?.error?.stack?.startsWith('Error: pets transform failed'), true)
  assertEquals(toResultAt(result.manifest.results, line?.trail ?? ''), 'error')

  // Every ERROR line with a trail joins to an `'error'` leaf.
  result.logs
    .filter(({ level, trail }) => level === 'ERROR' && trail !== undefined)
    .forEach(({ trail }) => assertEquals(toResultAt(result.manifest.results, trail ?? ''), 'error'))

  // The other model is unaffected, and the manifest carries no error payload.
  assertEquals(
    toResultAt(result.manifest.results, 'trace:generate:models:Fine:variant:main'),
    'success'
  )
  assertEquals(Object.keys(result.manifest).includes('logs'), false)
})

Deno.test('toArtifacts - a consumer whose peer throws has its own ERROR line', () => {
  const { value: result } = captureConsole(() => runThrowing('trace'))

  const consumer = errorLineAt(result.logs, 'trace:generate:ops:/users:get:variant:main')
  const peer = errorLineAt(result.logs, 'trace:generate:models:Broken:variant:main')

  assertEquals(consumer?.message, 'Broken cannot be modeled')
  assertEquals(peer?.message, 'Broken cannot be modeled')
})

Deno.test('toArtifacts - the default log level returns no DEBUG or INFO lines', () => {
  const { value: result } = captureConsole(() => runThrowing('trace'))

  assertEquals(result.logs.length > 0, true)
  assertEquals(
    result.logs.filter(({ level }) => level === 'DEBUG' || level === 'INFO'),
    []
  )
  assertEquals(
    result.logs.map(({ seq }) => seq),
    result.logs.map((_, index) => index)
  )
})

Deno.test('toArtifacts - logLevel DEBUG returns DEBUG lines', () => {
  const { value: result } = captureConsole(() => runThrowing('trace', 'DEBUG'))

  const debugLine = result.logs.find(({ level }) => level === 'DEBUG')

  assertEquals(debugLine?.message, 'transforming /pets')
  assertEquals(debugLine?.trail, 'trace:generate:ops:/pets:get:variant:main')
})

Deno.test('toArtifacts - a run nested in a transform keeps its lines apart', () => {
  const nested: { logs: LogLine[] }[] = []

  const outerGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error see above
    ops: toOasOperationEntry({
      id: 'ops',
      transform: ({ operation }) => {
        if (operation.path === '/pets') {
          nested.push(runThrowing('inner'))
          throw new Error('outer failed after the nested run')
        }
      }
    })
  })

  const { value: outer } = captureConsole(() =>
    toArtifacts({
      traceId: 'outer',
      spanId: 'span',
      document: { type: 'oas', value: document },
      settings: undefined,
      toGeneratorConfigMap: outerGenerators,
      startAt: Date.now(),
      silent: true,
      stackTrail: new StackTrail(['outer'])
    })
  )

  const outerLine = errorLineAt(outer.logs, 'outer:generate:ops:/pets:get:variant:main')

  assertEquals(outerLine?.message, 'outer failed after the nested run')
  assertEquals(
    outer.logs.every(({ trail }) => trail === undefined || trail.startsWith('outer:')),
    true
  )
  assertEquals(nested[0].logs.length > 0, true)
  assertEquals(
    nested[0].logs.every(({ trail }) => trail === undefined || trail.startsWith('inner:')),
    true
  )
})

Deno.test('toArtifacts - a critical line in a transform is one ERROR line and an error result', () => {
  const criticalGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error see above
    ops: toOasOperationEntry({
      id: 'ops',
      transform: ({ context, operation }) => {
        if (operation.path === '/pets') {
          context.logger.critical('critical thing')
        }
      }
    })
  })

  const { value: result } = captureConsole(() => runWith(criticalGenerators))

  assertEquals(
    result.logs.map(({ level, trail, message }) => ({ level, trail, message })),
    [
      {
        level: 'ERROR',
        trail: 'TEST:generate:ops:/pets:get:variant:main',
        message: 'critical thing'
      }
    ]
  )
  assertEquals(result.manifest.results, {
    TEST: {
      generate: {
        ops: {
          '/pets': { get: { variant: { main: 'error' } } },
          '/users': { get: { variant: { main: 'success' } } }
        }
      }
    }
  })
})

Deno.test('toArtifacts - two runs started together return only their own lines', async () => {
  const consoleStub = stub(console, 'log')

  const [first, second] = await Promise.all([
    Promise.resolve().then(() => runThrowing('first')),
    Promise.resolve().then(() => runThrowing('second'))
  ]).finally(() => consoleStub.restore())

  assertEquals(first.logs.length > 0, true)
  assertEquals(second.logs.length > 0, true)
  assertEquals(
    first.logs.every(({ trail }) => trail?.startsWith('first:')),
    true
  )
  assertEquals(
    second.logs.every(({ trail }) => trail?.startsWith('second:')),
    true
  )
})
