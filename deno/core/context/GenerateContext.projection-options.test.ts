/**
 * End-to-end engine smoke for caller options (`ProjectionOptions`).
 *
 * A model projection declares `{ suffix: string }` options and folds them
 * into its identifier name. An operation projection inserts it twice with
 * different options. Both definitions must land, each carrying its own
 * options; a peer that forgets the fold must fail the integrity check; keys
 * beyond `noExport` / `variant` / `options` must never reach the engine;
 * and the call surface must follow what each peer declares.
 *
 * Uses neutral doubles only (MockFile / MockDefinition / MockImport /
 * IdentifierBase) — core tests stay language-agnostic.
 */

import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertStrictEquals,
  assertThrows
} from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile, MockImport } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import { toRefName } from '@/helpers/refFns.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { OasOperationProjection } from '@/dsl/operation/oas/types.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { GenerateContextType, InsertModelOptions } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'

// An unconfigured named logger has no handlers, so it is silent.
const mockLogger: log.Logger = log.getLogger('projection-options-test-silent')

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) =>
    new MockDefinition({ context, identifier, value }),
  toImport: ({ identifier, module }) => new MockImport({ names: [identifier.name], module }),
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

const pet = toRefName('#/components/schemas/Pet')

type PetOptions = { suffix: string }

const PetBase = toModelProjectionBase<Enrichments, IdentifierType, PetOptions>(NeutralSnippet, {
  id: '@test/pet',
  toIdentifierName: ({ refName, options }) => `${refName}${options.suffix}`,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ refName, options }) => `@/models/${refName}${options.suffix}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PetModel extends PetBase {
  override toString() {
    return `{ kind: '${this.options.suffix}' }`
  }
}

/** Reads its options but never folds them into its name. */
const ForgetfulBase = toModelProjectionBase<Enrichments, IdentifierType, PetOptions>(
  NeutralSnippet,
  {
    id: '@test/forgetful',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: ({ refName }) => `@/models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
)

class ForgetfulModel extends ForgetfulBase {
  override toString() {
    return `{ kind: '${this.options.suffix}' }`
  }
}

const PlainBase = toModelProjectionBase(NeutralSnippet, {
  id: '@test/plain',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ refName }) => `@/models/${refName}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PlainModel extends PlainBase {
  override toString() {
    return '{}'
  }
}

const MaybeBase = toModelProjectionBase<Enrichments, IdentifierType, PetOptions | undefined>(
  NeutralSnippet,
  {
    id: '@test/maybe',
    toIdentifierName: ({ refName, options }) => `${refName}${options?.suffix ?? ''}`,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: ({ refName }) => `@/models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
)

class MaybeModel extends MaybeBase {
  override toString() {
    return '{}'
  }
}

const HandlerBase = toOasOperationProjectionBase(NeutralSnippet, {
  id: '@test/handler',
  toIdentifierName: () => 'handler',
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/handlers/handler.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class HandlerProjection extends HandlerBase {
  input = this.insertModel(PetModel, pet, { options: { suffix: 'Input' } })
  output = this.insertModel(PetModel, pet, { options: { suffix: 'Output' } })

  override toString() {
    return `(${this.input.toName()}) => ${this.output.toName()}`
  }
}

/** A non-literal trailing argument carrying a key the helper must not forward. */
const bag: InsertModelOptions = { destinationPath: '@/somewhere/else.ts' }

class LeakyHandler extends HandlerBase {
  static override id = '@test/leaky-handler'
  static override toExportPath = () => '@/handlers/leaky.ts'
  peer = this.insertModel(PlainModel, pet, bag)

  override toString() {
    return `() => ${this.peer.toName()}`
  }
}

const buildContext = <V extends GeneratedValue>(
  projection: OasOperationProjection<V, Enrichments>
) => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({ path: '/pets', method: 'post', pathItem: undefined, responses: {} })
    ]
  })

  const entry = toOasOperationEntry({
    id: projection.id,
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection, operation, variant })
    }
  })

  return new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ [projection.id]: entry }) as any
  })
}

Deno.test('projection options - each insertion carries its own options through name, file and value', () => {
  const context = buildContext(HandlerProjection)
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const inputFile = files.get('@/models/PetInput.generated.ts')
  const outputFile = files.get('@/models/PetOutput.generated.ts')
  assertExists(inputFile)
  assertExists(outputFile)
  assertInstanceOf(inputFile, CodeFileBase)
  assertInstanceOf(outputFile, CodeFileBase)

  const input = inputFile.findDefinitions({ name: 'PetInput' })?.[0]
  const output = outputFile.findDefinitions({ name: 'PetOutput' })?.[0]
  assertExists(input)
  assertExists(output)
  assertInstanceOf(input.value, PetModel)
  assertInstanceOf(output.value, PetModel)
  assertEquals(input.value.options, { suffix: 'Input' })
  assertEquals(output.value.options, { suffix: 'Output' })
  assertEquals(String(input.value), "{ kind: 'Input' }")

  const handlerFile = files.get('@/handlers/handler.generated.ts')
  assertExists(handlerFile)
  assertInstanceOf(handlerFile, CodeFileBase)
  assertEquals(
    String(handlerFile.findDefinitions({ name: 'handler' })?.[0]?.value),
    '(PetInput) => PetOutput'
  )
})

Deno.test('projection options - a cache hit with the same options is reused; different options throw', () => {
  const context = buildContext(HandlerProjection)

  const first = context.insertModel(ForgetfulModel, pet, { options: { suffix: 'Input' } })
  const again = context.insertModel(ForgetfulModel, pet, { options: { suffix: 'Input' } })
  assertStrictEquals(again.definition, first.definition)

  assertThrows(
    () => context.insertModel(ForgetfulModel, pet, { options: { suffix: 'Output' } }),
    Error,
    'Registered definition mismatch'
  )
})

Deno.test('projection options - only noExport, variant and options reach the engine from the trailing argument', () => {
  const context = buildContext(LeakyHandler)
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(files.has('@/somewhere/else.ts'), false)
  assertExists(files.get('@/models/Pet.generated.ts'))

  const handlerFile = files.get('@/handlers/leaky.generated.ts')
  assertInstanceOf(handlerFile, MockFile)
  assertEquals(handlerFile.imports.has('@/models/Pet.generated.ts'), true)

  // Same guarantee on the context: engine-owned keys cannot be overridden.
  const wide: InsertModelOptions & { refName: RefName } = {
    noExport: true,
    refName: toRefName('#/components/schemas/Other')
  }
  const inserted = context.insertModel(PlainModel, pet, wide)
  assertEquals(inserted.toName(), 'Pet')
  assertEquals(context.getFile('@/models/Other.generated.ts'), undefined)
})

// Type-level: the call surface follows what the peer declares. Never run.
export const _typeChecks = (
  context: GenerateContextType,
  refName: RefName,
  operation: OasOperation,
  handler: HandlerProjection
) => {
  context.insertModel(PetModel, refName, { options: { suffix: 'Input' } })
  context.insertModel(PetModel, refName, { options: { suffix: 'Input' }, noExport: true })
  // @ts-expect-error options are required when the peer declares them
  context.insertModel(PetModel, refName)
  // @ts-expect-error options are required when the peer declares them
  context.insertModel(PetModel, refName, { noExport: true })
  // @ts-expect-error options must match the declared shape
  context.insertModel(PetModel, refName, { options: { suffix: 1 } })

  context.insertModel(PlainModel, refName)
  context.insertModel(PlainModel, refName, { noExport: true })
  // @ts-expect-error a peer without options refuses stray ones
  context.insertModel(PlainModel, refName, { options: { suffix: 'Input' } })

  context.insertModel(MaybeModel, refName)
  context.insertModel(MaybeModel, refName, { options: { suffix: 'Input' } })

  context.insertOperation({ projection: HandlerProjection, operation })
  context.insertOperation({
    projection: HandlerProjection,
    operation,
    // @ts-expect-error a peer without options refuses stray ones
    options: { suffix: 'Input' }
  })

  handler.insertModel(PetModel, refName, { options: { suffix: 'Input' } })
  // @ts-expect-error options are required when the peer declares them
  handler.insertModel(PetModel, refName)
  handler.insertModel(PlainModel, refName)

  context.toModelContentSettings({ refName, projection: PlainModel, variant: 'main' })
  context.toModelContentSettings({
    refName,
    projection: PetModel,
    variant: 'main',
    options: { suffix: 'Input' }
  })
  // @ts-expect-error options are required when the peer declares them
  context.toModelContentSettings({ refName, projection: PetModel, variant: 'main' })
}
