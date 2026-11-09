/**
 * Pending Definitions: the marker a model's File holds while its projection
 * is being constructed, and `toModelRef`, which finds it. Real Drivers and a
 * real `GenerateContext`; each test model's constructor references the
 * models its test graph lists, so a cycle in the graph is a cycle of inserts.
 */
import { createVariable, toTsModelProjectionBase, TsFile } from '@skmtc/lang-typescript'
import { assertEquals, assertStringIncludes, assertThrows } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { RenderContext } from '@/context/RenderContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { PendingDefinition } from '@/dsl/PendingDefinition.ts'
import { isReferencedBack, toModelRef } from '@/dsl/model/ModelDriver.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import { toModelGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasString } from '@/oas/string/String.ts'
import { emptyEnrichmentSchema, type EmptyEnrichments } from '@/types/Enrichments.ts'
import type { RefName } from '@/types/RefName.ts'

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, critical: () => {} } as unknown as log.Logger

type Graph = Record<string, string[]>

/** The models of `graph`, a model in its own file unless `shared` names it, and a context to insert them. */
const toModels = (graph: Graph, shared: string[] = []) => {
  const toPath = (refName: string) => shared.includes(refName) ? '@/types/shared.generated.ts' : `@/types/${refName}.generated.ts`

  class Model extends toTsModelProjectionBase({
    id: '@test/models',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ refName }) => toPath(refName),
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }) {
    // deno-lint-ignore no-explicit-any -- test stub; insertNormalizedModel isn't exercised
    static schemaToValueFn: any = () => ({ toString: () => '' })
    static createIdentifier = createVariable
    /** Each reference this model made: the name, whether it came back suspended, and whether it is inside a cycle. */
    refs: { name: string; suspended: boolean; inCycle: boolean }[]
    recursive: boolean

    constructor(args: ModelProjectionConstructorArgs<EmptyEnrichments>) {
      super(args)

      if (args.refName === 'Broken') {
        throw new Error('Broken cannot be constructed')
      }

      this.refs = (graph[args.refName] ?? []).map(refName => {
        const ref = toModelRef({
          context: args.context,
          projection: Model,
          refName: refName as RefName,
          destinationPath: args.settings.exportPath
        })

        return { name: ref.settings.identifier.name, suspended: ref.suspended, inCycle: !ref.suspended && ref.inCycle }
      })
      this.recursive = isReferencedBack({ context: args.context, settings: args.settings })
    }

    override toString() {
      return `[${this.refs.map(({ name }) => name).join(', ')}]`
    }
  }

  const context = new GenerateContext({
    document: {
      type: 'oas',
      value: new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components: new OasComponents({
          schemas: Object.fromEntries([...Object.keys(graph), 'Broken'].map(name => [name, new OasString({})]))
        })
      })
    },
    settings: undefined,
    logger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

  const valueOf = (refName: string): Model => {
    const found = context.findDefinition({ name: refName, exportPath: toPath(refName) })
    const value = found === undefined || found.isPending() ? undefined : found.value

    if (!(value instanceof Model)) {
      throw new Error(`${refName} has no Definition`)
    }

    return value
  }

  return { Model, context, valueOf, toPath }
}

const pendingNames = (context: GenerateContext): string[] =>
  [...context.inspectedFiles.values()].flatMap(file =>
    file instanceof CodeFileBase ? file.findPendingDefinitions().map(({ identifier }) => identifier.name) : []
  )

Deno.test('a cycle across two files: the reference back is suspended, imported, and counted', () => {
  // Cloudflare's email rules: a group holds conditions, and a condition can be a group.
  const { Model, context, valueOf } = toModels({ Group: ['Condition'], Condition: ['Scalar', 'Group'], Scalar: [] })

  context.insertModel(Model, 'Group' as RefName)

  // Group → Condition is inside the cycle too: Condition reached Group while
  // Group was pending. Either model can be the first one loaded, so both
  // references in the cycle must be deferred, not only the one back.
  assertEquals(valueOf('Group').refs, [{ name: 'Condition', suspended: false, inCycle: true }])
  assertEquals(valueOf('Condition').refs, [
    { name: 'Scalar', suspended: false, inCycle: false },
    // The trap: Group's constructor has not returned, so its Definition is
    // not in the File. Without the marker the probe missed, and a second
    // Group projection was constructed, and a second Condition, without end.
    { name: 'Group', suspended: true, inCycle: false }
  ])
  // Only the model the cycle came back to is recursive.
  assertEquals(valueOf('Group').recursive, true)
  assertEquals(valueOf('Condition').recursive, false)
  // The reference back crosses files, so Condition's file imports Group.
  assertStringIncludes(`${context.getFile('@/types/Condition.generated.ts')}`, `import {Group} from '@/types/Group.generated.ts'`)
  // Every marker is gone once its constructor returned.
  assertEquals(pendingNames(context), [])
})

Deno.test('a second reference into the cycle, found in the cache, is inside the cycle too', () => {
  // A → B → C → A, and A → C again. C is constructed through B, so A's own
  // reference to C is a cache hit: no construction runs to show the cycle.
  // C's Definition carries what its construction reached (A, still pending).
  const { Model, context, valueOf } = toModels({ A: ['B', 'C'], B: ['C'], C: ['A'] })

  context.insertModel(Model, 'A' as RefName)

  assertEquals(valueOf('A').refs, [
    { name: 'B', suspended: false, inCycle: true },
    { name: 'C', suspended: false, inCycle: true }
  ])
  assertEquals(valueOf('B').refs, [{ name: 'C', suspended: false, inCycle: true }])
  assertEquals(valueOf('C').refs, [{ name: 'A', suspended: true, inCycle: false }])
})

Deno.test('a reference into a cycle from outside it is not inside the cycle', () => {
  // Once Group's constructor returned, nothing of the cycle is pending: a
  // model outside the cycle refers to Condition directly.
  const { Model, context, valueOf } = toModels({
    Group: ['Condition'],
    Condition: ['Group'],
    Outside: ['Condition']
  })

  context.insertModel(Model, 'Group' as RefName)
  context.insertModel(Model, 'Outside' as RefName)

  assertEquals(valueOf('Outside').refs, [{ name: 'Condition', suspended: false, inCycle: false }])
})

Deno.test('a model that refers to itself is suspended in its own file, with no import', () => {
  const { Model, context, valueOf } = toModels({ Node: ['Node'] })

  context.insertModel(Model, 'Node' as RefName)

  assertEquals(valueOf('Node').refs, [{ name: 'Node', suspended: true, inCycle: false }])
  assertEquals(valueOf('Node').recursive, true)
  assertEquals(`${context.getFile('@/types/Node.generated.ts')}`.includes('import'), false)
})

Deno.test("a model's Definition replaces its pending entry, and renders after what it refers to", () => {
  const { Model, context, toPath } = toModels({ A: ['B'], B: [] }, ['A', 'B'])

  context.insertModel(Model, 'A' as RefName)

  const file = context.getFile(toPath('A'))

  if (!(file instanceof TsFile)) {
    throw new Error('no TsFile for A and B')
  }

  // A's entry went in pending, before B was constructed; its Definition
  // replaced it and moved to the end, after B.
  assertEquals([...file.definitions.values()].map(({ identifier }) => identifier.name), ['B', 'A'])
  assertEquals(file.findPendingDefinitions(), [])
  // The trap: left where it went in pending, `const A = [B]` renders above
  // `const B`, and the module fails when it loads.
  const rendered = `${file}`
  assertEquals(rendered.indexOf('export const B') < rendered.indexOf('export const A'), true)
})

Deno.test('a constructor that throws takes its pending entry with it', () => {
  const { Model, context } = toModels({})

  assertThrows(() => context.insertModel(Model, 'Broken' as RefName), Error, 'Broken cannot be constructed')
  // A pending entry left behind would answer every later insert of Broken.
  assertEquals(pendingNames(context), [])
})

Deno.test('the Driver refuses to construct a second projection for a pending model', () => {
  // A reference back must go through toModelRef. insertModel is the Driver:
  // it finds the marker and throws instead of starting a construction that
  // would never finish.
  const { Model, context } = toModels({})
  const file = context.addFile(new TsFile({ path: '@/types/Loop.generated.ts', settings: undefined }))
  file.addDefinition(
    new PendingDefinition({
      identifier: createVariable('Loop'),
      generatorKey: toModelGeneratorKey({ generatorId: '@test/models', refName: 'Loop' as RefName, variant: 'main' }),
      options: undefined
    })
  )

  assertThrows(() => context.insertModel(Model, 'Loop' as RefName), Error, 'is being constructed further up the stack')
})

Deno.test('render fails the run when a pending entry is left', () => {
  const file = new TsFile({ path: '@/types/Left.ts', settings: undefined })
  file.addDefinition(
    new PendingDefinition({
      identifier: createVariable('Left'),
      generatorKey: toModelGeneratorKey({ generatorId: '@test/models', refName: 'Left' as RefName, variant: 'main' }),
      options: undefined
    })
  )
  const render = new RenderContext({
    files: new Map([[file.path, file]]),
    previews: {},
    basePath: undefined,
    logger,
    captureCurrentResult: () => {}
  })

  assertThrows(() => render.render(new StackTrail([])), Error, `'Left' in '@/types/Left.ts'`)
})
