/**
 * One runner runs the four kinds of subject: an OpenAPI operation, a
 * webhook, a GraphQL operation and a model. Each test here asks the same
 * question of all four, through a real run, so a kind that answers the
 * runner differently from the others fails beside them.
 */
import { assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { GenerationFailure } from '@/context/toGenerationFailure.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasWebhook } from '@/oas/webhook/Webhook.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toWebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import { toGqlOperationEntry } from '@/dsl/operation/gql/toGqlOperationEntry.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema, type Enrichments } from '@/types/Enrichments.ts'
import type { GeneratorConfig } from '@/types/GeneratorType.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { ResultType } from '@/types/Results.ts'
import type { Preview, PreviewModule } from '@/types/Preview.ts'

const GENERATOR = 'gen'

/** The preview module a test entry gives for a subject, by the subject's name. */
const toTestPreviewModule = (name: string): PreviewModule => ({
  name: `${name}Preview`,
  exportPath: `@/${name}.ts`
})

/** One object entry of `settings.skip`. An entry of `settings.include` has the same shape. */
type FilterEntry = Exclude<NonNullable<ClientSettings['skip']>[number], string>

/** An entry of any kind with no enrichments of its own. */
type Entry = GeneratorConfig<Enrichments<undefined, undefined, undefined>>

/** What a test tells an entry to do with a subject, by the subject's name. */
type Behavior = {
  isSupported?: (name: string) => boolean
  transform?: (name: string, variant: string) => void
  /** Give the entry a `toPreviewModule` that returns {@link toTestPreviewModule}. */
  hasPreview?: boolean
}

/**
 * One kind of subject for the tests: a document with the two subjects
 * `first` and `second`, an entry of the kind, and where the kind keeps a
 * subject's results, its enrichments and its filter.
 */
type Kind = {
  name: string
  document: SkmtcParsedDocument
  toEntry: (behavior: Behavior) => Entry
  /** A subject's frames in a trail, below the generator's. */
  toTrail: (name: string) => string
  /** A subject's enrichments, as the value at the generator's id. */
  toEnrichments: (name: string, block: unknown) => Record<string, unknown>
  /** A `settings.include` or `settings.skip` entry that names every variant of a subject. */
  toFilter: (name: string) => FilterEntry
  hasFilters: boolean
  /** The source of a subject's preview, for the `main` variant. */
  toSource: (name: string) => Preview['source']
}

const oasDocument = new OasDocument({
  openapi: '3.1.0',
  info: new OasInfo({ title: 'Test', version: '1.0.0' }),
  operations: ['first', 'second'].map(
    name => new OasOperation({ path: `/${name}`, method: 'get', pathItem: undefined, responses: {} })
  ),
  webhooks: ['first', 'second'].map(
    name => new OasWebhook({ name, method: 'post', pathItem: undefined, responses: {} })
  ),
  components: new OasComponents({
    schemas: Object.fromEntries(['first', 'second'].map(name => [name, new OasString({})]))
  })
})

const gqlDocument = new GqlDocument({
  registry: new GqlRegistry({ schemas: {} }),
  operations: ['first', 'second'].map(
    name =>
      new GqlOperation({ rootKind: 'query', fieldName: name, arguments: [], returnType: new OasString({}) })
  ),
  rootTypes: {}
})

const kinds: Kind[] = [
  {
    name: 'an OpenAPI operation',
    document: { type: 'oas', value: oasDocument },
    toEntry: ({ isSupported, transform, hasPreview }) =>
      toOasOperationEntry({
        id: GENERATOR,
        toEnrichmentSchema: () => emptyEnrichmentSchema,
        isSupported: ({ operation }) => isSupported?.(operation.path.slice(1)) ?? true,
        transform: ({ operation, variant }) => transform?.(operation.path.slice(1), variant),
        toPreviewModule: hasPreview
          ? ({ operation }) => toTestPreviewModule(operation.path.slice(1))
          : undefined
      }),
    toTrail: name => `/${name}:get`,
    toEnrichments: (name, block) => ({ [`/${name}`]: { get: block } }),
    toFilter: name => ({ [GENERATOR]: { [`/${name}`]: { get: [] } } }),
    hasFilters: true,
    toSource: name => ({
      type: 'oasOperation',
      generatorId: GENERATOR,
      operationPath: `/${name}`,
      operationMethod: 'get',
      variant: 'main'
    })
  },
  {
    name: 'a webhook',
    document: { type: 'oas', value: oasDocument },
    toEntry: ({ isSupported, transform, hasPreview }) =>
      toWebhookEntry({
        id: GENERATOR,
        toEnrichmentSchema: () => emptyEnrichmentSchema,
        isSupported: ({ webhook }) => isSupported?.(webhook.name) ?? true,
        transform: ({ webhook, variant }) => transform?.(webhook.name, variant),
        toPreviewModule: hasPreview ? ({ webhook }) => toTestPreviewModule(webhook.name) : undefined
      }),
    toTrail: name => `webhook:${name}:post`,
    toEnrichments: (name, block) => ({ [name]: { post: block } }),
    toFilter: name => ({ [GENERATOR]: { [name]: { post: [] } } }),
    hasFilters: true,
    toSource: name => ({
      type: 'webhook',
      generatorId: GENERATOR,
      webhookName: name,
      webhookMethod: 'post',
      variant: 'main'
    })
  },
  {
    name: 'a GraphQL operation',
    document: { type: 'gql', value: gqlDocument },
    toEntry: ({ isSupported, transform, hasPreview }) =>
      toGqlOperationEntry({
        id: GENERATOR,
        toEnrichmentSchema: () => emptyEnrichmentSchema,
        isSupported: ({ operation }) => isSupported?.(operation.fieldName) ?? true,
        transform: ({ operation, variant }) => transform?.(operation.fieldName, variant),
        toPreviewModule: hasPreview ? ({ operation }) => toTestPreviewModule(operation.fieldName) : undefined
      }),
    toTrail: name => `query:${name}`,
    toEnrichments: (name, block) => ({ query: { [name]: block } }),
    // A filter of settings has no shape that names a GraphQL operation.
    toFilter: () => ({ [GENERATOR]: { query: {} } }),
    hasFilters: false,
    toSource: name => ({
      type: 'gqlOperation',
      generatorId: GENERATOR,
      rootKind: 'query',
      fieldName: name,
      variant: 'main'
    })
  },
  {
    name: 'a model',
    document: { type: 'oas', value: oasDocument },
    toEntry: ({ isSupported, transform, hasPreview }) =>
      toModelEntry({
        id: GENERATOR,
        toEnrichmentSchema: () => emptyEnrichmentSchema,
        isSupported: ({ ref }) => isSupported?.(ref.refName) ?? true,
        transform: ({ ref, variant }) => transform?.(ref.refName, variant),
        toPreviewModule: hasPreview ? ({ ref }) => toTestPreviewModule(ref.refName) : undefined
      }),
    toTrail: name => name,
    toEnrichments: (name, block) => ({ [name]: block }),
    toFilter: name => ({ [GENERATOR]: { [name]: [] } }),
    hasFilters: true,
    toSource: name => ({ type: 'model', generatorId: GENERATOR, refName: name, variant: 'main' })
  }
]

type RunArgs = {
  kind: Kind
  behavior?: Behavior
  settings?: ClientSettings
  /** Where the results go. A test of a run that throws passes its own, to read them afterwards. */
  results?: Record<string, ResultType>
  /** Where the run's previews go, by module name. */
  previews?: Record<string, Preview>
}

/** One run of the kind's entry: each result by its trail below the generator's. */
const run = ({ kind, behavior = {}, settings, results = {}, previews = {} }: RunArgs): Record<string, ResultType> => {
  const entry = kind.toEntry(behavior)

  const context = new GenerateContext({
    document: kind.document,
    settings,
    logger: log.getLogger('subject-test'),
    captureCurrentResult: (result, trail) => {
      results[`${trail}`.replace(`test:${GENERATOR}:`, '')] = result
    },
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field
    toGeneratorConfigMap: () => ({ [GENERATOR]: entry })
  })

  Object.assign(previews, context.toArtifacts(new StackTrail(['test'])).previews)

  return results
}

for (const kind of kinds) {
  const first = `${kind.toTrail('first')}:variant:main`
  const second = `${kind.toTrail('second')}:variant:main`

  Deno.test(`${kind.name} - each subject has one result, at its own place in the trail`, () => {
    assertEquals(run({ kind }), { [first]: 'success', [second]: 'success' })
  })

  Deno.test(`${kind.name} - a subject the entry does not support is notSupported, and is not transformed`, () => {
    const transformed: string[] = []

    const results = run({
      kind,
      behavior: { isSupported: name => name === 'first', transform: name => transformed.push(name) }
    })

    assertEquals(results, { [first]: 'success', [second]: 'notSupported' })
    assertEquals(transformed, ['first'])
  })

  Deno.test(`${kind.name} - a subject that settings.skip names is skipped`, () => {
    const results = run({ kind, settings: { skip: [kind.toFilter('second')] } })

    // The trap: a GraphQL operation has no filter, so it runs.
    assertEquals(results, { [first]: 'success', [second]: kind.hasFilters ? 'skipped' : 'success' })
  })

  Deno.test(`${kind.name} - with settings.include, a subject it does not name is skipped`, () => {
    const results = run({ kind, settings: { include: [kind.toFilter('first')] } })

    assertEquals(results, { [first]: 'success', [second]: kind.hasFilters ? 'skipped' : 'success' })
  })

  Deno.test(`${kind.name} - isSupported is asked before a filter`, () => {
    const results = run({
      kind,
      behavior: { isSupported: name => name === 'first' },
      settings: { skip: [kind.toFilter('second')] }
    })

    assertEquals(results[second], 'notSupported')
  })

  Deno.test(`${kind.name} - each variant in a subject's enrichments has its own result`, () => {
    const variants: string[] = []

    const results = run({
      kind,
      behavior: { transform: (name, variant) => variants.push(`${name} ${variant}`) },
      settings: { enrichments: { [GENERATOR]: kind.toEnrichments('first', { main: {}, other: {} }) } }
    })

    assertEquals(results, {
      [first]: 'success',
      [`${kind.toTrail('first')}:variant:other`]: 'success',
      [second]: 'success'
    })
    assertEquals(variants, ['first main', 'first other', 'second main'])
  })

  Deno.test(`${kind.name} - a transform that throws gives error for its subject, and the others still run`, () => {
    const results: Record<string, ResultType> = {}
    const transform = (name: string): void => {
      if (name === 'first') {
        throw new Error('broken')
      }
    }

    // The run fails when every subject has run, and names the subject that threw.
    assertThrows(() => run({ kind, behavior: { transform }, results }), GenerationFailure, first)
    assertEquals(results, { [first]: 'error', [second]: 'success' })
  })

  Deno.test(`${kind.name} - a transformed subject's preview has the source of its kind`, () => {
    const previews: Record<string, Preview> = {}

    run({ kind, behavior: { hasPreview: true }, previews })

    assertEquals(
      Object.fromEntries(Object.entries(previews).map(([name, preview]) => [name, preview.source])),
      { firstPreview: kind.toSource('first'), secondPreview: kind.toSource('second') }
    )
  })
}
