/**
 * The file plan says, before a run, which subjects hold each file. These
 * tests build a plan as a run would: a document read by the real parser,
 * `Reach` from that parse, the subjects of the parsed document, and entries
 * that list their projections.
 */
import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ModelSubject, OasOperationSubject, type PlannedSubject } from '@/context/Subject.ts'
import type { FilePlan } from '@/context/FilePlan.ts'
import type { DeclaredProjection } from '@/dsl/DeclaredProjection.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toSchemaComponentRef } from '@/helpers/refFns.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { ClientSettings } from '@/types/Settings.ts'

const schema = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (name: string) => ({ description: 'ok', content: { 'application/json': { schema: schema(name) } } })

// Order -> Customer -> Address, and Customer -> Order back. Tag stands alone.
const document = {
  openapi: '3.0.3',
  info: { title: 'Plan', version: '1.0.0' },
  paths: {
    '/orders': { get: { responses: { '200': json('Order') } } },
    '/tags': { get: { responses: { '200': json('Tag') } } },
    '/ping': { get: { responses: { '204': { description: 'ok' } } } }
  },
  components: {
    schemas: {
      Order: { type: 'object', properties: { customer: schema('Customer') } },
      Customer: { type: 'object', properties: { address: schema('Address'), last: schema('Order') } },
      Address: { type: 'object' },
      Tag: { type: 'string' }
    }
  }
}

/** A model projection as an entry declares it: one file for each model. */
const modelFiles: DeclaredProjection = {
  id: 'models',
  type: 'model',
  toEnrichments: () => undefined,
  toExportPath: ({ ref }) => `@/models/${ref.refName}.ts`
}

/** An operation projection as an entry declares it: one file for each variant of each operation. */
const operationFiles: DeclaredProjection = {
  id: 'operations',
  type: 'oasOperation',
  toEnrichments: () => undefined,
  toExportPath: ({ operation, variant }) => `@/operations${operation.path}.${variant}.ts`
}

const toEntries = (operationProjections: DeclaredProjection[]) => ({
  models: toModelEntry({
    id: 'models',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    projections: [modelFiles],
    transform: () => {}
  }),
  operations: toOasOperationEntry({
    id: 'operations',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    projections: operationProjections,
    transform: () => {}
  })
})

type Planned = {
  plan: FilePlan
  context: GenerateContext
  operation: (path: string) => PlannedSubject
  model: (name: string) => PlannedSubject
  subjects: PlannedSubject[]
}

type ToPlannedArgs = {
  settings?: ClientSettings
  operationProjections?: DeclaredProjection[]
  /** The document to plan; the one above when absent. */
  source?: Record<string, unknown>
}

const toPlanned = ({
  settings,
  operationProjections = [operationFiles, modelFiles],
  source = document
}: ToPlannedArgs = {}): Planned => {
  const logger = log.getLogger('file-plan-test')
  // @ts-expect-error a test document is not typed as an OpenAPI document
  const parseContext = new ParseContext({ input: { type: 'oas', value: source }, logger, silent: true })
  const parsed = parseContext.parse(new StackTrail(['test']))

  if (parsed.type !== 'oas') {
    throw new Error('The test document is OpenAPI')
  }

  const entries = toEntries(operationProjections)

  const context = new GenerateContext({
    document: parsed,
    settings,
    logger,
    captureCurrentResult: () => {},
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field
    toGeneratorConfigMap: () => entries
  })

  const operations = new Map(
    parsed.value.operations.map(operation => [operation.path, new OasOperationSubject(operation)])
  )
  const models = new Map(
    [...(parsed.value.components?.toSchemasRefNames() ?? [])].map(refName => [
      `${refName}`,
      new ModelSubject(toSchemaComponentRef(refName))
    ])
  )
  const subjects = [...operations.values(), ...models.values()]
  const find = (subject: PlannedSubject | undefined, name: string): PlannedSubject => {
    if (subject === undefined) {
      throw new Error(`The test document has no '${name}'`)
    }

    return subject
  }

  return {
    plan: context.toFilePlan({ subjects, reach: parseContext.toReach() }),
    context,
    operation: path => find(operations.get(path), path),
    model: name => find(models.get(name), name),
    subjects
  }
}

const modelFile = (name: string) => `@/models/${name}.generated.ts`
const operationFile = (path: string, variant = 'main') => `@/operations${path}.${variant}.generated.ts`
const sorted = (paths: readonly string[]) => [...paths].sort()

Deno.test('FilePlan - an operation holds its own file, and the files of the models it names and of what they reach', () => {
  const { plan, operation } = toPlanned()

  assertEquals(
    sorted(plan.filesOf(operation('/orders'))),
    sorted([operationFile('/orders'), modelFile('Order'), modelFile('Customer'), modelFile('Address')])
  )
  assertEquals(sorted(plan.filesOf(operation('/tags'))), sorted([operationFile('/tags'), modelFile('Tag')]))
  assertEquals(plan.filesOf(operation('/ping')), [operationFile('/ping')])
})

Deno.test('FilePlan - a model holds its own file and the files of the models it reaches', () => {
  const { plan, model } = toPlanned()

  assertEquals(plan.filesOf(model('Address')), [modelFile('Address')])
  assertEquals(
    sorted(plan.filesOf(model('Customer'))),
    sorted([modelFile('Customer'), modelFile('Order'), modelFile('Address')])
  )
})

// The trap: a file is complete when the LAST subject that holds it has run.
// Tag's file is held by the model Tag and by the operation that names it.
Deno.test('FilePlan - finish gives a file when the last subject that holds it has run, and not before', () => {
  const { plan, operation, model } = toPlanned()

  assertEquals(plan.finish(model('Tag')), [])
  assertEquals(sorted(plan.finish(operation('/tags'))), sorted([operationFile('/tags'), modelFile('Tag')]))
  assertEquals(plan.finish(operation('/ping')), [operationFile('/ping')])
})

// The models of a cycle hold each other's files, so none is given before
// the last of them, and of the operations that name them, has run.
Deno.test('FilePlan - the files of a cycle are given when the last model of it has run', () => {
  const { plan, operation, model } = toPlanned()

  assertEquals(plan.finish(operation('/orders')), [operationFile('/orders')])
  assertEquals(plan.finish(model('Order')), [])
  assertEquals(plan.finish(model('Address')), [])
  assertEquals(
    sorted(plan.finish(model('Customer'))),
    sorted([modelFile('Order'), modelFile('Customer'), modelFile('Address')])
  )
})

for (const order of ['document order', 'reverse order']) {
  Deno.test(`FilePlan - every file is given one time when every subject has run, in ${order}`, () => {
    const { plan, subjects } = toPlanned()
    const ordered = order === 'document order' ? subjects : [...subjects].reverse()
    const given = ordered.flatMap(subject => plan.finish(subject))

    assertEquals(
      sorted(given),
      sorted([
        ...['/orders', '/tags', '/ping'].map(path => operationFile(path)),
        ...['Order', 'Customer', 'Address', 'Tag'].map(modelFile)
      ])
    )
  })
}

// The trap: two generators can write one file, as gen-zod and gen-typescript
// do. The file is one file in the plan, and it is given one time.
Deno.test('FilePlan - two projections that map a model to one file hold one file', () => {
  const sameFile: DeclaredProjection = { ...modelFiles, id: 'types' }
  const { plan, operation, model } = toPlanned({ operationProjections: [operationFiles, modelFiles, sameFile] })

  assertEquals(sorted(plan.filesOf(operation('/tags'))), sorted([operationFile('/tags'), modelFile('Tag')]))
  assertEquals(plan.finish(model('Tag')), [])
  assertEquals(sorted(plan.finish(operation('/tags'))), sorted([operationFile('/tags'), modelFile('Tag')]))
})

Deno.test('FilePlan - each variant in a subject\'s enrichments has its own file', () => {
  const { plan, operation } = toPlanned({
    settings: { enrichments: { operations: { '/ping': { get: { main: {}, other: {} } } } } }
  })

  assertEquals(
    sorted(plan.filesOf(operation('/ping'))),
    sorted([operationFile('/ping', 'main'), operationFile('/ping', 'other')])
  )
})

// The run reports a static that throws, where it happens. The plan leaves
// that file out and counts it, and it still plans the rest.
Deno.test('FilePlan - a projection whose static throws is left out for that subject, and counted', () => {
  const throwsForTags: DeclaredProjection = {
    id: 'operations',
    type: 'oasOperation',
    toEnrichments: () => undefined,
    toExportPath: ({ operation, variant }) => {
      if (operation.path === '/tags') {
        throw new Error('no path for /tags')
      }

      return `@/operations${operation.path}.${variant}.ts`
    }
  }

  const { plan, operation } = toPlanned({ operationProjections: [throwsForTags, modelFiles] })

  assertEquals(plan.unanswered, 1)
  assertEquals(plan.filesOf(operation('/tags')), [modelFile('Tag')])
  assertEquals(plan.filesOf(operation('/ping')), [operationFile('/ping')])
})

// The run runs each variant on its own, so a variant whose static throws
// leaves out its own file and not the files of the other variants.
Deno.test('FilePlan - a variant whose static throws is left out, and the other variants are planned', () => {
  const throwsForOther: DeclaredProjection = {
    id: 'operations',
    type: 'oasOperation',
    toEnrichments: () => undefined,
    toExportPath: ({ operation, variant }) => {
      if (variant === 'other') {
        throw new Error('no path for other')
      }

      return `@/operations${operation.path}.${variant}.ts`
    }
  }

  const { plan, operation } = toPlanned({
    settings: { enrichments: { operations: { '/ping': { get: { main: {}, other: {} } } } } },
    operationProjections: [throwsForOther, modelFiles]
  })

  assertEquals(plan.unanswered, 1)
  assertEquals(plan.filesOf(operation('/ping')), [operationFile('/ping', 'main')])
})

// A `$ref` to a place inside a schema gives a model that is no component.
// Its enrichments are at its whole pointer, as the run reads them.
Deno.test('FilePlan - a model that is no component reads its variants at its whole pointer', () => {
  const pointer = '#/components/schemas/Pet/properties/tag'
  const variantFiles: DeclaredProjection = {
    id: 'variants',
    type: 'model',
    toEnrichments: () => undefined,
    toExportPath: ({ ref, variant }) => `@/models/${ref.refName}.${variant}.ts`
  }

  const { plan, operation } = toPlanned({
    source: {
      openapi: '3.0.3',
      info: { title: 'Pointer', version: '1.0.0' },
      paths: {
        '/tag': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: pointer } } } } } } }
      },
      components: {
        schemas: { Pet: { type: 'object', properties: { tag: { type: 'string' } } } }
      }
    },
    settings: { enrichments: { variants: { [pointer]: { main: {}, admin: {} } } } },
    operationProjections: [operationFiles, variantFiles]
  })

  assertEquals(plan.unanswered, 0)
  assertEquals(
    sorted(plan.filesOf(operation('/tag'))),
    sorted([
      operationFile('/tag'),
      modelFile('tag'),
      '@/models/tag.main.generated.ts',
      '@/models/tag.admin.generated.ts'
    ])
  )
})

Deno.test('FilePlan - a generator that settings.skip names whole adds no file to the plan', () => {
  const { plan, operation, model } = toPlanned({
    settings: { skip: ['models'] },
    operationProjections: [operationFiles]
  })

  assertEquals(plan.filesOf(model('Tag')), [])
  assertEquals(plan.filesOf(operation('/tags')), [operationFile('/tags')])
})

Deno.test('FilePlan - a subject that has run, or that the plan was not given, holds nothing', () => {
  const { plan, operation, context } = toPlanned()

  if (context.document.type !== 'oas') {
    throw new Error('The test document is OpenAPI')
  }

  plan.finish(operation('/ping'))

  assertEquals(plan.finish(operation('/ping')), [])
  assertEquals(plan.filesOf(operation('/ping')), [])
  assertEquals(plan.finish(new OasOperationSubject(context.document.value.operations[0])), [])
})

// The trap: every read of an enrichment counts as a use in the run's audit.
// The plan reads for a projection that the run may never insert. Here
// `peer` is only in a list, and no generator of the run has that id: the
// run must still say that its enrichments name no generator.
Deno.test('FilePlan - building the plan leaves the warnings of the run as they are', () => {
  const peer: DeclaredProjection = { ...modelFiles, id: 'peer' }
  const settings: ClientSettings = { enrichments: { peer: { Tag: { main: {} } } } }
  const toWarnings = (context: GenerateContext) =>
    context.toArtifacts(new StackTrail(['test'])).enrichmentWarnings.map(({ type, path }) => ({ type, path }))

  const planned = toPlanned({ settings, operationProjections: [operationFiles, peer] })
  const unplanned = new GenerateContext({
    document: planned.context.document,
    settings,
    logger: log.getLogger('file-plan-test'),
    captureCurrentResult: () => {},
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field
    toGeneratorConfigMap: () => toEntries([operationFiles, peer])
  })

  assertEquals(toWarnings(planned.context), [{ type: 'UNKNOWN_GENERATOR_ID', path: ['peer'] }])
  assertEquals(toWarnings(planned.context), toWarnings(unplanned))
})
