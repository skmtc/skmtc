/**
 * The dependency-placement guarantee at the engine boundary (the
 * generator skill's axiom 2, "Placement").
 *
 * A producer declares a dependency by inserting it from its constructor.
 * The engine guarantees the dependency is registered NO LATER than the
 * dependent: either it already existed (its own visit or another
 * producer's insert registered it earlier), or the insert runs the
 * dependency's full Driver lifecycle synchronously inside the
 * dependent's constructor — before the dependent's own registration.
 * Files render definitions in registration order, so a same-file
 * dependency always renders ABOVE the item that declared it, whichever
 * visit order the schema map produced.
 *
 * Uses neutral doubles only (MockFile / MockDefinition / IdentifierBase)
 * — core tests stay language-agnostic.
 */

import { assert, assertExists } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'

// An unconfigured named logger has no handlers, so it is silent — a
// real Logger, no structural double, no cast.
const mockLogger: log.Logger = log.getLogger('placement-test-silent')

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) => new MockDefinition({ context, identifier, value }),
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
  id: '@test/placement',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/models.txt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/**
 * `Owner` declares a dependency on `Dep` from its constructor — the
 * axiom-2 shape. Both land in the same file.
 */
class DependentModel extends ModelBase {
  constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
    super(args)

    if (args.refName === 'Owner') {
      args.context.insertModel(DependentModel, 'Dep' as RefName)
    }
  }

  override toString(): string {
    return this.refName
  }
}

const renderModelsFile = (schemaNames: string[]): string => {
  const document = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    components: new OasComponents({
      schemas: Object.fromEntries(schemaNames.map(name => [name, new OasString({})]))
    })
  })

  const entry = toModelEntry({
    id: '@test/placement',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, refName }) => {
      context.insertModel(DependentModel, refName)
    }
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: document },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // The contract is a GENERIC callback (`<E>() => GeneratorsMapContainer<E>`),
    // which no concrete entry can satisfy honestly — a direct cast fails
    // TS2352 (insufficient overlap), so the cast below is forced by that
    // type shape, not by this test. Core cleanup candidate: make the
    // container's enrichment type flow from the entries instead of the
    // caller's type argument.
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/placement': entry }) as any
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const file = files.get('@/models.generated.txt')
  assertExists(file)

  return file.toString()
}

const assertDepRendersAboveOwner = (content: string) => {
  const depAt = content.indexOf('def Dep')
  const ownerAt = content.indexOf('def Owner')

  assert(depAt !== -1, 'Dep definition missing from rendered file')
  assert(ownerAt !== -1, 'Owner definition missing from rendered file')
  assert(
    depAt < ownerAt,
    `dependency must render above its dependent, got:\n${content}`
  )
}

Deno.test('placement - a dependency inserted during the dependent constructor renders above it', () => {
  assertDepRendersAboveOwner(renderModelsFile(['Owner', 'Dep']))
})

Deno.test('placement - a dependency registered by its own earlier visit still renders above the dependent', () => {
  assertDepRendersAboveOwner(renderModelsFile(['Dep', 'Owner']))
})
