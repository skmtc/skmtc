/**
 * A run that fails outside the per-item catches gives one `RUN_FAILED`
 * issue. Its `location` names the entry and the phase that threw, its
 * `cause` keeps the stack, and its `protocol` is the input's.
 */
import { assertEquals } from '@std/assert'
import { stub } from '@std/testing/mock'
import type { OpenAPIV3 } from 'openapi-types'
import { CoreContext } from '@/context/CoreContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { emptyEnrichmentSchema, type Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { SkmtcDocumentInput } from '@/types/SkmtcDocument.ts'

const ok = { responses: { '200': { description: 'ok' } } }

const oasDocument: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: { '/pets': { get: ok } },
  components: { schemas: { User: { type: 'string' } } }
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

/** Renders by throwing, so the run fails in Render. */
class UnrenderableModel extends ModelBase {
  override toString(): string {
    throw new Error('cannot render User')
  }
}

const renderFailingGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
  models: toModelEntry({
    id: 'models',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, refName }) => {
      context.insertModel(UnrenderableModel, refName)
    }
  })
})

const operationGenerators = <E = undefined>(): GeneratorsMapContainer<E> => ({
  // @ts-expect-error see above
  ops: toOasOperationEntry({ id: 'ops', transform: () => {} })
})

// `toVariantList` throws outside the per-variant `try` when the
// enrichments of an operation have no `main` variant.
const noMainSettings: ClientSettings = {
  enrichments: { ops: { '/pets': { get: { admin: {} } } } }
}

type RunArgs = {
  document: SkmtcDocumentInput
  settings?: ClientSettings
  toGeneratorConfigMap?: <E = undefined>() => GeneratorsMapContainer<E>
}

const runToArtifacts = ({
  document,
  settings,
  toGeneratorConfigMap = operationGenerators
}: RunArgs) => {
  const consoleStubs = [stub(console, 'log'), stub(console, 'error')]

  try {
    return new CoreContext({ spanId: 's', silent: true }).toArtifacts({
      document,
      settings,
      toGeneratorConfigMap,
      stackTrail: new StackTrail(['TEST']),
      silent: true
    }).parseIssues
  } finally {
    consoleStubs.forEach(consoleStub => consoleStub.restore())
  }
}

const runFailedIssues = (issues: ParseIssue[]) => issues.filter(({ type }) => type === 'RUN_FAILED')

const assertRunFailed = (
  issues: ParseIssue[],
  expected: { protocol: 'oas' | 'gql'; location: string; message: string }
) => {
  const failed = runFailedIssues(issues)

  assertEquals(failed.length, 1)
  const [issue] = failed

  if (issue.level !== 'error') {
    throw new Error('expected an error issue')
  }
  assertEquals(issue.protocol, expected.protocol)
  assertEquals(issue.location, expected.location)
  assertEquals(issue.message, expected.message)
  assertEquals(issue.cause?.stack?.includes(issue.cause.message), true)
}

Deno.test('toArtifacts - a throw in Render names the render phase', () => {
  assertRunFailed(
    runToArtifacts({
      document: { type: 'oas', value: oasDocument },
      toGeneratorConfigMap: renderFailingGenerators
    }),
    {
      protocol: 'oas',
      location: 'toArtifacts:render',
      message: 'render phase failed: cannot render User'
    }
  )
})

Deno.test('toArtifacts - a throw in Parse names the parse phase', () => {
  assertRunFailed(
    runToArtifacts({ document: { type: 'oas', value: { ...oasDocument, openapi: '4.0.0' } } }),
    {
      protocol: 'oas',
      location: 'toArtifacts:parse',
      message:
        'parse phase failed: Unsupported OpenAPI version: 4.0.0 — expected 3.0.x, 3.1.x or 3.2.x'
    }
  )
})

Deno.test('toArtifacts - a throw in Generate outside the per-item catches names generate', () => {
  const [issue] = runFailedIssues(
    runToArtifacts({ document: { type: 'oas', value: oasDocument }, settings: noMainSettings })
  )

  assertEquals(issue.location, 'toArtifacts:generate')
  assertEquals(issue.message.startsWith('generate phase failed: '), true)
})

Deno.test('toArtifacts - a GraphQL input gives a gql RUN_FAILED issue', () => {
  const [issue] = runFailedIssues(
    runToArtifacts({
      document: { type: 'gql', value: 'type User { id: String } type Query { getUser: User }' },
      toGeneratorConfigMap: renderFailingGenerators
    })
  )

  assertEquals(issue.protocol, 'gql')
  assertEquals(issue.location, 'toArtifacts:render')
})

Deno.test('toSupportedSubjects and toEnrichmentDefaults - the failure names the entry and phase', () => {
  const context = new CoreContext({ spanId: 's', silent: true })
  const args = {
    document: { type: 'oas' as const, value: oasDocument },
    settings: undefined,
    // Read during Generate, outside any per-item catch.
    toGeneratorConfigMap: <E = undefined>(): GeneratorsMapContainer<E> => {
      throw new Error('no generators')
    },
    stackTrail: new StackTrail(['TEST'])
  }
  const consoleStub = stub(console, 'log')

  try {
    const subjectIssues = context.toSupportedSubjects(args).parseIssues
    const defaultsIssues = context.toEnrichmentDefaults(args).parseIssues
    const parseIssues = context.toSupportedSubjects({
      ...args,
      document: { type: 'oas', value: { ...oasDocument, openapi: '4.0.0' } }
    }).parseIssues

    assertEquals(
      [subjectIssues, defaultsIssues, parseIssues].map(issues =>
        runFailedIssues(issues).map(({ location }) => location)
      ),
      [
        ['toSupportedSubjects:generate'],
        ['toEnrichmentDefaults:generate'],
        ['toSupportedSubjects:parse']
      ]
    )
  } finally {
    consoleStub.restore()
  }
})
