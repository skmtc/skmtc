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
    /** Each reference this model made: the name, and whether it came back suspended. */
    refs: { name: string; suspended: boolean }[]
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

        return { name: ref.settings.identifier.name, suspended: ref.suspended }
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
    const value = context.findDefinition({ name: refName, exportPath: toPath(refName) })?.value

    if (!(value instanceof Model)) {
      throw new Error(`${refName} has no Definition`)
    }

    return value
  }

  return { Model, context, valueOf, toPath }
}

const pendingNames = (context: GenerateContext): string[] =>
  [...context.inspectedFiles.values()].flatMap(file =>
    file instanceof CodeFileBase ? [...file.pendingDefinitions.keys()] : []
  )

Deno.test('a cycle across two files: the reference back is suspended, imported, and counted', () => {
  // Cloudflare's email rules: a group holds conditions, and a condition can be a group.
  const { Model, context, valueOf } = toModels({ Group: ['Condition'], Condition: ['Scalar', 'Group'], Scalar: [] })

  context.insertModel(Model, 'Group' as RefName)

  assertEquals(valueOf('Group').refs, [{ name: 'Condition', suspended: false }])
  assertEquals(valueOf('Condition').refs, [
    { name: 'Scalar', suspended: false },
    // The trap: Group's constructor has not returned, so its Definition is
    // not in the File. Without the marker the probe missed, and a second
    // Group projection was constructed, and a second Condition, without end.
    { name: 'Group', suspended: true }
  ])
  // Only the model the cycle came back to is recursive.
  assertEquals(valueOf('Group').recursive, true)
  assertEquals(valueOf('Condition').recursive, false)
  // The reference back crosses files, so Condition's file imports Group.
  assertStringIncludes(`${context.getFile('@/types/Condition.generated.ts')}`, `import {Group} from '@/types/Group.generated.ts'`)
  // Every marker is gone once its constructor returned.
  assertEquals(pendingNames(context), [])
})

Deno.test('a model that refers to itself is suspended in its own file, with no import', () => {
  const { Model, context, valueOf } = toModels({ Node: ['Node'] })

  context.insertModel(Model, 'Node' as RefName)

  assertEquals(valueOf('Node').refs, [{ name: 'Node', suspended: true }])
  assertEquals(valueOf('Node').recursive, true)
  assertEquals(`${context.getFile('@/types/Node.generated.ts')}`.includes('import'), false)
})

Deno.test('in one file, a Definition still lands after the models it refers to', () => {
  // The marker takes no position: A is marked pending first, but B is
  // registered first, as before markers. `const A = [B]` above `const B`
  // would fail when the module loads.
  const { Model, context, toPath } = toModels({ A: ['B'], B: [] }, ['A', 'B'])

  context.insertModel(Model, 'A' as RefName)

  const file = context.getFile(toPath('A'))
  const names = file instanceof TsFile ? file.findDefinitions()?.map(({ identifier }) => identifier.name) : undefined

  assertEquals(names, ['B', 'A'])
})

Deno.test('a constructor that throws takes its marker with it', () => {
  const { Model, context } = toModels({})

  assertThrows(() => context.insertModel(Model, 'Broken' as RefName), Error, 'Broken cannot be constructed')
  // A marker left behind would answer every later insert of Broken.
  assertEquals(pendingNames(context), [])
})

Deno.test('the Driver refuses to construct a second projection for a pending model', () => {
  // A reference back must go through toModelRef. insertModel is the Driver:
  // it finds the marker and throws instead of starting a construction that
  // would never finish.
  const { Model, context } = toModels({})
  const file = context.addFile(new TsFile({ path: '@/types/Loop.generated.ts', settings: undefined }))
  file.pendingDefinitions.set(
    'Loop',
    new PendingDefinition({
      identifier: createVariable('Loop'),
      generatorKey: toModelGeneratorKey({ generatorId: '@test/models', refName: 'Loop' as RefName, variant: 'main' }),
      options: undefined
    })
  )

  assertThrows(() => context.insertModel(Model, 'Loop' as RefName), Error, 'is being constructed further up the stack')
})

Deno.test('render fails the run when a marker is left', () => {
  const file = new TsFile({ path: '@/types/Left.ts', settings: undefined })
  file.pendingDefinitions.set(
    'Left',
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
