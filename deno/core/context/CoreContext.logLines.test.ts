/**
 * The INFO lines a run logs: one after parse, one per generator, one after
 * render and one with the totals. Each count is checked against what the
 * run returns.
 */
import { assertEquals, assertExists } from '@std/assert'
import { stub } from '@std/testing/mock'
import type { OpenAPIV3 } from 'openapi-types'
import { CoreContext } from '@/context/CoreContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { emptyEnrichmentSchema, type Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { LogLine, LogLineLevel } from '@/types/LogLine.ts'
import type { ResultsItem } from '@/types/Results.ts'

const ok = { responses: { '200': { description: 'ok' } } }

const cleanDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'T', version: '1' },
  paths: { '/pets': { get: ok, post: ok }, '/owners': { get: ok } },
  components: { schemas: { Pet: { type: 'string' }, Owner: { type: 'string' } } }
}

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
    return 'model'
  }
}

/** One file per model. */
const ModelBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'models',
  toIdentifierName: ({ ref }) => ref.refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ ref }) => `@/${ref.refName}.txt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class Model extends ModelBase {}

/** `failing` names the model whose transform throws. */
const toGenerators =
  (failing?: string) =>
  <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
    models: toModelEntry({
      id: 'models',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      transform: ({ context, ref }) => {
        if (ref.refName === failing) {
          throw new Error(`cannot generate ${ref.refName}`)
        }

        context.insertModel(Model, ref)
      }
    }),
    // @ts-expect-error see above
    ops: toOasOperationEntry({
      id: 'ops',
      isSupported: ({ operation }) => operation.method === 'get',
      transform: () => {}
    })
  })

type RunArgs = {
  document: OpenAPIV3.Document
  logLevel?: LogLineLevel
  failing?: string
}

const run = ({ document, logLevel = 'INFO', failing }: RunArgs) => {
  const consoleStubs = [stub(console, 'log'), stub(console, 'error'), stub(console, 'info')]

  try {
    return new CoreContext({ spanId: 's', silent: false, logLevel }).toArtifacts({
      document: { type: 'oas', value: document },
      settings: undefined,
      toGeneratorConfigMap: toGenerators(failing),
      stackTrail: new StackTrail(['TEST']),
      silent: false
    })
  } finally {
    consoleStubs.forEach(consoleStub => consoleStub.restore())
  }
}

const infoLines = (logs: LogLine[]) => logs.filter(({ level }) => level === 'INFO')

const toLine = (logs: LogLine[], prefix: string): LogLine => {
  const line = infoLines(logs).find(({ message }) => message.startsWith(prefix))
  assertExists(line, `no INFO line starts with '${prefix}'`)

  return line
}

/** The results the run captured under `generatorId`, one per subject variant. */
const toSubjectResults = (results: ResultsItem, generatorId: string): string[] => {
  const generate = results.TEST
  if (typeof generate !== 'object' || Array.isArray(generate) || generate === null) return []
  const phase = generate.generate
  if (typeof phase !== 'object' || Array.isArray(phase) || phase === null) return []

  const leaves = (node: ResultsItem[string]): string[] => {
    if (typeof node === 'string') return [node]
    if (node === null || node === undefined || Array.isArray(node)) return []

    return Object.values(node).flatMap(leaves)
  }

  return leaves(phase[generatorId])
}

Deno.test('toArtifacts - a clean run logs parse, each generator, render and the totals at INFO', () => {
  const result = run({ document: cleanDocument })
  const lines = infoLines(result.logs)
  const artifacts = Object.entries(result.artifacts)
  const bytes = artifacts.reduce(
    (total, [, content]) => total + new TextEncoder().encode(content).length,
    0
  )

  assertEquals(result.parseIssues, [])
  assertEquals(artifacts.length, 2)
  assertEquals(lines.length, 5)

  const parseLine = toLine(result.logs, 'parse: ')
  assertEquals(
    parseLine.message.replace(/\d+ ms$/, 'N ms'),
    'parse: OpenAPI 3.0.3, 3 operations, 2 models, 0 errors, 0 warnings, 0 debug, N ms'
  )
  assertEquals(parseLine.trail, undefined)

  const modelResults = toSubjectResults(result.results, 'models')
  assertEquals(modelResults, ['success', 'success'])
  const modelsLine = toLine(result.logs, 'models: ')
  assertEquals(
    modelsLine.message.replace(/\d+ ms$/, 'N ms'),
    `models: 2 of 2 models, 0 failed, ${artifacts.length} files, N ms`
  )
  assertEquals(modelsLine.trail, 'TEST:generate:models')

  // The generator's `isSupported` takes the two GETs: the POST is offered, not taken.
  const operationResults = toSubjectResults(result.results, 'ops')
  assertEquals(operationResults.filter(value => value === 'success').length, 2)
  assertEquals(operationResults.length, 3)
  const operationsLine = toLine(result.logs, 'ops: ')
  assertEquals(
    operationsLine.message.replace(/\d+ ms$/, 'N ms'),
    'ops: 2 of 3 operations, 0 failed, 0 files, N ms'
  )
  assertEquals(operationsLine.trail, 'TEST:generate:ops')

  const renderLine = toLine(result.logs, 'render: ')
  assertEquals(
    renderLine.message.replace(/\d+ ms$/, 'N ms'),
    `render: ${artifacts.length} files, ${bytes} bytes, N ms`
  )
  assertEquals(renderLine.trail, undefined)

  const totalsLine = toLine(result.logs, 'toArtifacts: ')
  assertEquals(
    totalsLine.message.replace(/\d+ ms$/, 'N ms'),
    `toArtifacts: 2 generators, ${artifacts.length} files, ${bytes} bytes, ` +
      '0 errors, 0 warnings, 0 debug, N ms'
  )
  assertEquals(lines.at(-1), totalsLine)
})

Deno.test("toArtifacts - a generator's line counts the subject that failed", () => {
  const result = run({ document: cleanDocument, failing: 'Owner' })

  assertEquals(toSubjectResults(result.results, 'models').sort(), ['error', 'success'])
  assertEquals(
    toLine(result.logs, 'models: ').message.replace(/\d+ ms$/, 'N ms'),
    'models: 2 of 2 models, 1 failed, 1 file, N ms'
  )
})

Deno.test('toArtifacts - a dangling ref is logged as a sentence, with the issue beside it', () => {
  const document: OpenAPIV3.Document = {
    ...cleanDocument,
    paths: {
      '/owners': {
        get: {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Missing' } }
              }
            }
          }
        }
      }
    }
  }

  const result = run({ document })
  const issue = result.parseIssues.find(({ type }) => type === 'DANGLING_REF')
  assertExists(issue)

  const line = result.logs.find(({ issue }) => issue?.type === 'DANGLING_REF')
  assertExists(line)
  assertEquals(line.level, 'ERROR')
  assertEquals(
    line.message,
    `DANGLING_REF at #/paths/~1owners/get/responses/200/content/application~1json/schema: ${issue.message}`
  )
  assertEquals(line.issue?.type, issue.type)
  assertEquals(line.issue?.level, issue.level)
  assertEquals(line.issue?.location, issue.location)
  assertExists(line.issue?.parent)
})

Deno.test('toArtifacts - at the WARN log level the INFO lines are left out', () => {
  const result = run({ document: cleanDocument, logLevel: 'WARN' })

  assertEquals(infoLines(result.logs), [])
  assertEquals(result.logs, [])
})

Deno.test('toArtifacts - at the WARN log level a clean run prints nothing to the console', () => {
  const logStub = stub(console, 'error')

  try {
    new CoreContext({ spanId: 's', silent: false }).toArtifacts({
      document: { type: 'oas', value: cleanDocument },
      settings: undefined,
      toGeneratorConfigMap: toGenerators(),
      stackTrail: new StackTrail(['TEST']),
      silent: false
    })

    assertEquals(logStub.calls.length, 0)
  } finally {
    logStub.restore()
  }
})

Deno.test('toArtifacts - a silent run logs no INFO lines', () => {
  const consoleStubs = [stub(console, 'log'), stub(console, 'error')]

  try {
    const result = new CoreContext({ spanId: 's', silent: true, logLevel: 'INFO' }).toArtifacts({
      document: { type: 'oas', value: cleanDocument },
      settings: undefined,
      toGeneratorConfigMap: toGenerators(),
      stackTrail: new StackTrail(['TEST']),
      silent: true
    })

    assertEquals(infoLines(result.logs), [])
  } finally {
    consoleStubs.forEach(consoleStub => consoleStub.restore())
  }
})
