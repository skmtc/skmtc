/**
 * A run that is given `onArtifact` goes subject by subject and gives each
 * file when it is complete. These tests run a document both ways, with
 * generators that share files and insert each other's projections, and
 * compare what the two runs give.
 *
 * Neutral doubles only (MockFile, MockDefinition): core tests stay
 * language-agnostic.
 */
import { assert, assertEquals } from '@std/assert'
import { toArtifacts } from '@/run/toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile, MockImport } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { isReferencedBack, toModelRef } from '@/dsl/model/ModelDriver.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { toWebhookProjectionBase } from '@/dsl/webhook/toWebhookProjectionBase.ts'
import { toWebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { OasOperationProjectionConstructorArgs } from '@/dsl/operation/oas/types.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import { toSchemaComponentRef, type RefParts } from '@/helpers/refFns.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import { oxcAdapter } from '@/anchors/oxcAdapter.ts'
import { normalizeWorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'

const schema = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (name: string) => ({ description: 'ok', content: { 'application/json': { schema: schema(name) } } })

// Order -> Customer -> Address, and Customer -> Order back. Tag stands
// alone, and Zed is the last model and names nothing. The operation for
// Tag, a late model, is before the one for Order, an early model.
const schemas = {
  Order: { type: 'object', properties: { customer: schema('Customer') } },
  Customer: { type: 'object', properties: { address: schema('Address'), last: schema('Order') } },
  Address: { type: 'object' },
  Tag: { type: 'string' },
  Zed: { type: 'string' }
}

const document = toDocumentObject(
  {
    openapi: '3.0.3',
    info: { title: 'Release', version: '1.0.0' },
    paths: {
      '/ping': { get: { responses: { '204': { description: 'ok' } } } },
      '/tags': { get: { responses: { '200': json('Tag') } } },
      '/orders': { get: { responses: { '200': json('Order') } } }
    },
    components: { schemas }
  },
  'release document'
)

// The same models, and one operation for Customer, the second model of the cycle.
const customersDocument = toDocumentObject(
  {
    openapi: '3.0.3',
    info: { title: 'Customers', version: '1.0.0' },
    paths: { '/customers': { get: { responses: { '200': json('Customer') } } } },
    components: { schemas }
  },
  'customers document'
)

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) => new MockDefinition({ context, identifier, value }),
  toImport: ({ identifier, module }) => new MockImport({ names: [identifier.name], module }),
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

/** The name of each model a model's schema refers to in its properties. */
const toNamedRefs = (context: GenerateContextType, ref: RefParts): RefParts[] => {
  const value = context.resolveSchemaRefOnce(ref)

  return value.isRef() || value.type !== 'object'
    ? []
    : Object.values(value.properties ?? {}).flatMap(property => (property.isRef() ? [property] : []))
}

// Two model generators write one file for each model, as gen-typescript and
// gen-zod do, so the order of the two definitions in it is part of the bytes.
const ShapeBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'shapes',
  toIdentifierName: ({ ref }) => `${ref.refName}Shape`,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ ref }) => `@/models/${ref.refName}.txt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/** The models whose shape throws when it is rendered. A test adds to it and clears it. */
const brokenShapes = new Set<string>()

class Shape extends ShapeBase {
  names: string[]
  /** A model that a model in its cycle refers back to. A validator gives such a model a type annotation. */
  isReferredBack: boolean

  constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
    super(args)

    // A model names each model it refers to, and so constructs it. One in a cycle refers back.
    this.names = toNamedRefs(args.context, args.ref).map(
      ref =>
        toModelRef({
          context: args.context,
          ref,
          projection: Shape,
          destinationPath: args.settings.exportPath
        }).settings.identifier.name
    )

    this.isReferredBack = isReferencedBack({ context: args.context, settings: args.settings })
  }

  override toString(): string {
    if (brokenShapes.has(this.ref.refName)) {
      throw new Error('toString broke')
    }

    return `shape(${this.names.join(', ')})${this.isReferredBack ? ' referredBack' : ''}`
  }
}

const CheckBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'checks',
  toIdentifierName: ({ ref }) => `${ref.refName}Check`,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ ref }) => `@/models/${ref.refName}.txt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class Check extends CheckBase {
  names: string[]

  constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
    super(args)

    this.names = toNamedRefs(args.context, args.ref).map(
      ref =>
        toModelRef({
          context: args.context,
          ref,
          projection: Check,
          destinationPath: args.settings.exportPath
        }).settings.identifier.name
    )
  }

  override toString(): string {
    return `check(${this.names.join(', ')})`
  }
}

const CallBase = toOasOperationProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'calls',
  toIdentifierName: ({ operation }) => `call${operation.path.replaceAll('/', '_')}`,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ operation }) => `@/calls${operation.path}.txt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class Call extends CallBase {
  response: string

  constructor(args: OasOperationProjectionConstructorArgs<Enrichments>) {
    super(args)

    // An operation takes the check and the shape of its response from the model generators.
    const response = args.operation.toSuccessResponse()?.resolve().toSchema()

    this.response =
      response?.isRef() === true
        ? [Check, Shape].map(projection => args.context.insertModel(projection, response).toName()).join(' & ')
        : 'nothing'
  }

  override toString(): string {
    return `call(${this.response})`
  }
}

// One file that every operation adds a line to, as a file of routes is.
const ListedBase = toOasOperationProjectionBase<Enrichments>(NeutralSnippet, {
  id: 'calls',
  toIdentifierName: ({ operation }) => `listed${operation.path.replaceAll('/', '_')}`,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/calls/all.txt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class Listed extends ListedBase {
  override toString(): string {
    return this.operation.path
  }
}

/** What a test adds to the three generators, and what it watches. */
type RunArgs = {
  onArtifact?: (path: string, content: string) => void
  onTransform?: (subject: string) => void
  /** One more model generator, with no list, that runs `transform` for each model. */
  extra?: (args: { context: GenerateContextType; ref: RefParts }) => void
  inspect?: boolean
  /** Asks for attribution with a post-pass, which writes a sidecar for each file. */
  postPass?: boolean
  /** The document of the run, when it is not the release document. */
  input?: typeof document
  /** Lists the operation generator before the two model generators. */
  operationsFirst?: boolean
}

const run = ({ onArtifact, onTransform, extra, inspect, postPass, input, operationsFirst }: RunArgs = {}) => {
  const toListed = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field
    shapes: toModelEntry({
      id: 'shapes',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Shape],
      transform: ({ context, ref }) => {
        onTransform?.(ref.refName)
        context.insertModel(Shape, ref)
      }
    }),
    // @ts-expect-error see above
    checks: toModelEntry({
      id: 'checks',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Check],
      transform: ({ context, ref }) => {
        context.insertModel(Check, ref)
      }
    }),
    // @ts-expect-error see above
    calls: toOasOperationEntry({
      id: 'calls',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Call, Listed, Check, Shape],
      transform: ({ context, operation }) => {
        onTransform?.(operation.path)
        context.insertOperation({ projection: Call, operation })
        context.insertOperation({ projection: Listed, operation })
      }
    }),
    ...(extra === undefined
      ? {}
      : {
          extra: toModelEntry({
            id: 'extra',
            toEnrichmentSchema: () => emptyEnrichmentSchema,
            transform: extra
          })
        })
  })

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => {
    const listed = toListed<E>()
    const { calls, ...models } = listed

    return operationsFirst === true ? { calls, ...models } : listed
  }

  return toArtifacts({
    traceId: 'trace',
    spanId: 'span',
    document: { type: 'oas', value: input ?? document },
    settings: { basePath: './src' },
    toGeneratorConfigMap: generators,
    startAt: 0,
    silent: true,
    stackTrail: new StackTrail(['TEST']),
    inspect,
    attribution: postPass === true ? { postPass: { parser: oxcAdapter, schemaSrc: 'openapi.json' } } : undefined,
    onArtifact
  })
}

const toSink = () => {
  const given: Record<string, string> = {}
  const paths: string[] = []

  return {
    given,
    paths,
    onArtifact: (path: string, content: string) => {
      given[path] = content
      paths.push(path)
    }
  }
}

/** A model's file and an operation's file, as keys of `artifacts`. */
const modelFile = (name: string) => `src/models/${name}.generated.txt`
const callFile = (path: string) => `src/calls${path}.generated.txt`

const sortedKeys = (record: Record<string, unknown>) => Object.keys(record).sort()
const toRunFailed = (result: ReturnType<typeof run>) =>
  result.manifest.parseIssues.filter(issue => issue.type === 'RUN_FAILED')

Deno.test('toArtifacts - a run with onArtifact gives every file of a plain run, with the same bytes', () => {
  const plain = run()
  const sink = toSink()
  const released = run({ onArtifact: sink.onArtifact })

  // The trap: two generators write `models/Order.txt`. Its bytes hold the
  // order of their definitions, which a run in another order could change.
  assertEquals(sink.given, plain.artifacts)
  assertEquals(sink.paths.length, Object.keys(plain.artifacts).length)
  assertEquals(released.artifacts, {})
})

// The trap: a file that every operation adds to has its entries in the order
// the operations ran. `/tags` is before `/orders` in the document, and the
// models of `/orders` are before the model of `/tags`. An order that runs an
// operation as soon as its models have run would put `/orders` first.
Deno.test('toArtifacts - a file that every operation adds to keeps the order of the document', () => {
  const sink = toSink()

  run({ onArtifact: sink.onArtifact })

  const all = sink.given['src/calls/all.generated.txt']

  assert(all.indexOf('/ping') < all.indexOf('/tags'), all)
  assert(all.indexOf('/tags') < all.indexOf('/orders'), all)
  assertEquals(all, run().artifacts['src/calls/all.generated.txt'])
})

Deno.test('toArtifacts - a run with onArtifact has the manifest of a plain run', () => {
  const plain = run().manifest
  const released = run({ onArtifact: () => {} }).manifest

  assertEquals(released.results, plain.results)
  assertEquals(sortedKeys(released.files), sortedKeys(plain.files))
  assert(plain.files[modelFile('Order')] !== undefined)
  assertEquals(released.files[modelFile('Order')], plain.files[modelFile('Order')])
  assertEquals(released.parseIssues, plain.parseIssues)
})

Deno.test('toArtifacts - a file is given when the last subject that holds it has run, before the run ends', () => {
  const events: string[] = []
  const sink = toSink()

  run({
    onTransform: subject => events.push(`run ${subject}`),
    onArtifact: (path, content) => {
      events.push(`give ${path}`)
      sink.onArtifact(path, content)
    }
  })

  const at = (event: string) => events.indexOf(event)

  // The first operation names no model, so it runs before any model, and its file is complete at once.
  assert(at(`give ${callFile('/ping')}`) !== -1)
  assert(at(`give ${callFile('/ping')}`) < at('run Order'))
  // Tag's file is held by the model and by the operation that names it.
  assert(at('run Tag') < at('run /tags'))
  assert(at('run /tags') < at(`give ${modelFile('Tag')}`))
  assert(at(`give ${modelFile('Tag')}`) < at('run Zed'))
  // The files of a cycle wait for the last model of it, and for the operation that names one of them.
  assert(at('run Customer') < at(`give ${modelFile('Order')}`))
  assert(at('run /orders') < at(`give ${modelFile('Order')}`))
})

// The trap: `extra` lists no projection, and for the last model it inserts
// the shape of Tag, which it does not reach. Tag's file was complete and
// given by then. Without the check the run would write a second Tag file.
Deno.test('toArtifacts - a generator that writes to a file that was given fails the run, and the error names the file', () => {
  const sink = toSink()

  const result = run({
    onArtifact: sink.onArtifact,
    extra: ({ context, ref }) => {
      if (ref.refName === 'Zed') {
        context.insertModel(Shape, toSchemaComponentRef('Tag' as RefName))
      }
    }
  })

  const [failure] = toRunFailed(result)

  assert(failure !== undefined, 'the run fails')
  assert(failure.message.includes('@/models/Tag.generated.txt'), failure.message)
  assert(failure.message.includes("'projections'"), failure.message)
  assertEquals(result.manifest.files, {})
})

Deno.test('toArtifacts - the same generator does no harm in a plain run', () => {
  const result = run({
    extra: ({ context, ref }) => {
      if (ref.refName === 'Zed') {
        context.insertModel(Shape, toSchemaComponentRef('Tag' as RefName))
      }
    }
  })

  assertEquals(toRunFailed(result), [])
})

Deno.test('toArtifacts - after a subject fails, a run with onArtifact gives no more files, and has none', () => {
  const sink = toSink()

  const result = run({
    onArtifact: sink.onArtifact,
    extra: ({ ref }) => {
      if (ref.refName === 'Order') {
        throw new Error('broken')
      }
    }
  })

  // Only the file of the operation that ran before the first model was given.
  assertEquals(sink.paths, [callFile('/ping')])
  assertEquals(toRunFailed(result).length, 1)
  assertEquals(result.manifest.files, {})
  assertEquals(result.artifacts, {})
})

// An inspection reads every file when the run has generated all of them.
Deno.test('toArtifacts - a run with inspect gives every file at the end', () => {
  const events: string[] = []
  const plain = run()

  run({
    inspect: true,
    onTransform: subject => events.push(`run ${subject}`),
    onArtifact: path => events.push(`give ${path}`)
  })

  const firstGiven = events.findIndex(event => event.startsWith('give'))

  assertEquals(events.slice(firstGiven).every(event => event.startsWith('give')), true)
  assertEquals(events.slice(firstGiven).length, Object.keys(plain.artifacts).length)
})

// A capturing render reads every file at the end of the run. A file that is
// rendered before then has no sidecar.
Deno.test('toArtifacts - a run with attribution.postPass gives every file at the end, each with its sidecar', () => {
  const events: string[] = []
  const plain = run({ postPass: true })

  const released = run({
    postPass: true,
    onTransform: subject => events.push(`run ${subject}`),
    onArtifact: path => events.push(`give ${path}`)
  })

  const firstGiven = events.findIndex(event => event.startsWith('give'))

  assertEquals(events.slice(firstGiven).every(event => event.startsWith('give')), true)
  assertEquals(Object.keys(released.sidecars ?? {}).length, Object.keys(plain.artifacts).length)
})

// The read guards: a generator that only looks up a file that was given,
// and writes nothing, fails the run as a write does.
Deno.test('toArtifacts - a generator that reads a file that was given fails the run, and the error names the file', () => {
  const lookups = [
    (context: GenerateContextType) => context.getFile('@/models/Tag.generated.txt'),
    (context: GenerateContextType) =>
      context.getFileByWorkspacePath(normalizeWorkspacePath('@/models/Tag.generated.txt'))
  ]

  lookups.forEach(lookup => {
    const result = run({
      onArtifact: () => {},
      extra: ({ context, ref }) => {
        if (ref.refName === 'Zed') {
          lookup(context)
        }
      }
    })

    const [failure] = toRunFailed(result)

    assert(failure !== undefined, 'the run fails')
    assert(failure.message.includes('@/models/Tag.generated.txt'), failure.message)
  })
})

// A file that is complete is rendered in the generate phase, with the phase
// name set to render, so that a throw in it is reported as in a plain run.
Deno.test('toArtifacts - a toString that throws is a render failure, with onArtifact or without it', () => {
  brokenShapes.add('Tag')

  try {
    const events: string[] = []

    const runs = [
      run(),
      run({
        onTransform: subject => events.push(`run ${subject}`),
        onArtifact: path => events.push(`give ${path}`)
      })
    ]

    // Tag's file is complete before the last model runs, so it is rendered in the generate phase.
    assert(!events.includes('run Zed'), events.join('\n'))

    runs.forEach(result => {
      const [failure] = toRunFailed(result)

      assert(failure !== undefined, 'the run fails')
      assert(failure.message.startsWith('render phase failed'), failure.message)
    })
  } finally {
    brokenShapes.clear()
  }
})

// The trap: an operation generator that is listed before the model generators
// gets to a model before the model's own generator does. In a run that kept
// the order of the config, the operation for Customer would enter the cycle
// at Customer, so Customer would have the mark and not Order, and the call
// would put the check before the shape in Customer's file. A run with
// onArtifact always starts from the models.
Deno.test('toArtifacts - an operation generator that is listed first changes no file, with onArtifact or without it', () => {
  const listed = run({ input: customersDocument })
  const first = run({ input: customersDocument, operationsFirst: true })
  const sink = toSink()

  run({ input: customersDocument, operationsFirst: true, onArtifact: sink.onArtifact })

  assert(listed.artifacts[modelFile('Order')].includes('referredBack'), listed.artifacts[modelFile('Order')])
  assert(!listed.artifacts[modelFile('Customer')].includes('referredBack'), listed.artifacts[modelFile('Customer')])
  assertEquals(first.artifacts, listed.artifacts)
  assertEquals(sink.given, listed.artifacts)
})

// The trap: a model generator that writes every model to one file, after an
// operation generator that inserts its projection. If the operations ran
// first, they would create the models in their order: Tag before Order.
Deno.test('toArtifacts - a file that one model generator writes for every model has the order of the document, both ways', () => {
  const EveryBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
    id: 'every',
    toIdentifierName: ({ ref }) => `${ref.refName}Every`,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: () => '@/models/all.txt',
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class Every extends EveryBase {
    override toString(): string {
      return 'every'
    }
  }

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error see `run`
    asks: toOasOperationEntry({
      id: 'asks',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Every],
      transform: ({ context, operation }) => {
        const response = operation.toSuccessResponse()?.resolve().toSchema()

        if (response?.isRef() === true) {
          context.insertModel(Every, response)
        }
      }
    }),
    // @ts-expect-error see `run`
    every: toModelEntry({
      id: 'every',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Every],
      transform: ({ context, ref }) => {
        context.insertModel(Every, ref)
      }
    })
  })

  const toAll = (withSink: boolean) => {
    const sink = toSink()

    const result = toArtifacts({
      traceId: 'trace',
      spanId: 'span',
      document: { type: 'oas', value: document },
      settings: { basePath: './src' },
      toGeneratorConfigMap: generators,
      startAt: 0,
      silent: true,
      stackTrail: new StackTrail(['TEST']),
      onArtifact: withSink ? sink.onArtifact : undefined
    })

    const all = { ...result.artifacts, ...sink.given }['src/models/all.generated.txt']

    assert(all !== undefined)

    return all
  }

  const plain = toAll(false)

  assert(plain.indexOf('OrderEvery') < plain.indexOf('TagEvery'), plain)
  assertEquals(toAll(true), plain)
})

// The trap: a run with onArtifact runs the operations before the webhooks. A
// run that kept the order of the config would run the webhook generator
// first here, and the file that both add to would start with the webhook.
Deno.test('toArtifacts - a webhook generator that is listed before an operation generator runs after it, both ways', () => {
  const RouteBase = toOasOperationProjectionBase<Enrichments>(NeutralSnippet, {
    id: 'routes',
    toIdentifierName: ({ operation }) => `route${operation.path.replaceAll('/', '_')}`,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: () => '@/handlers/all.txt',
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class Route extends RouteBase {
    override toString(): string {
      return 'route'
    }
  }

  const HookBase = toWebhookProjectionBase<Enrichments>(NeutralSnippet, {
    id: 'hooks',
    toIdentifierName: ({ webhook }) => `hook_${webhook.name}`,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: () => '@/handlers/all.txt',
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class Hook extends HookBase {
    override toString(): string {
      return 'hook'
    }
  }

  const hooksDocument = toDocumentObject(
    {
      openapi: '3.0.3',
      info: { title: 'Hooks', version: '1.0.0' },
      paths: { '/ping': { get: { responses: { '204': { description: 'ok' } } } } },
      webhooks: { pinged: { post: { responses: { '204': { description: 'ok' } } } } }
    },
    'hooks document'
  )

  const generators = <E = undefined>(): GeneratorsMapContainer<E> => ({
    // @ts-expect-error see `run`
    hooks: toWebhookEntry({
      id: 'hooks',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Hook],
      transform: ({ context, webhook }) => {
        context.insertWebhook({ projection: Hook, webhook })
      }
    }),
    // @ts-expect-error see `run`
    routes: toOasOperationEntry({
      id: 'routes',
      toEnrichmentSchema: () => emptyEnrichmentSchema,
      projections: [Route],
      transform: ({ context, operation }) => {
        context.insertOperation({ projection: Route, operation })
      }
    })
  })

  const toAll = (withSink: boolean) => {
    const sink = toSink()

    const result = toArtifacts({
      traceId: 'trace',
      spanId: 'span',
      document: { type: 'oas', value: hooksDocument },
      settings: { basePath: './src' },
      toGeneratorConfigMap: generators,
      startAt: 0,
      silent: true,
      stackTrail: new StackTrail(['TEST']),
      onArtifact: withSink ? sink.onArtifact : undefined
    })

    const all = { ...result.artifacts, ...sink.given }['src/handlers/all.generated.txt']

    assert(all !== undefined)

    return all
  }

  const plain = toAll(false)

  const route = plain.indexOf('route_ping')
  const hook = plain.indexOf('hook_pinged')

  assert(route >= 0 && hook >= 0, plain)
  assert(route < hook, plain)
  assertEquals(toAll(true), plain)
})
