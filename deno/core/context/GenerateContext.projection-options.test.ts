/**
 * End-to-end engine smoke for caller options (`ProjectionOptions`).
 *
 * A model projection declares `{ suffix: string }` options and folds them
 * into its identifier name. An operation projection inserts it twice with
 * different options. Both definitions must land, each carrying its own
 * options, and the call surface must follow what each peer declares:
 * options required when declared, refused when not.
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { TsSnippet } from '@skmtc/lang-typescript'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

type PetOptions = { suffix: string }

const PetBase = toModelProjectionBase<Enrichments, IdentifierType, PetOptions>(TsSnippet, {
  id: '@test/pet',
  toIdentifierName: ({ refName, options }) => `${refName}${options.suffix}`,
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ refName, options }) => `@/models/${refName}${options.suffix}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PetModel extends PetBase {
  override toString() {
    return `{ kind: '${this.options.suffix}' }`
  }
}

const PlainBase = toModelProjectionBase(TsSnippet, {
  id: '@test/plain',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ refName }) => `@/models/${refName}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PlainModel extends PlainBase {
  override toString() {
    return '{}'
  }
}

const MaybeBase = toModelProjectionBase<Enrichments, IdentifierType, PetOptions | undefined>(
  TsSnippet,
  {
    id: '@test/maybe',
    toIdentifierName: ({ refName, options }) => `${refName}${options?.suffix ?? ''}`,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `@/models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
)

class MaybeModel extends MaybeBase {
  override toString() {
    return '{}'
  }
}

const HandlerBase = toOasOperationProjectionBase(TsSnippet, {
  id: '@test/handler',
  toIdentifierName: () => 'handler',
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/handlers/handler.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class HandlerProjection extends HandlerBase {
  input = this.insertModel(PetModel, 'Pet' as RefName, { options: { suffix: 'Input' } })
  output = this.insertModel(PetModel, 'Pet' as RefName, { options: { suffix: 'Output' } })

  override toString() {
    return `(${this.input.toName()}) => ${this.output.toName()}`
  }
}

const buildContext = () => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({ path: '/pets', method: 'post', pathItem: undefined, responses: {} })
    ]
  })

  const entry = toOasOperationEntry({
    id: '@test/handler',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: HandlerProjection, operation, variant })
    }
  })

  return new GenerateContext({
    document: { type: 'oas', value: doc },
    // deno-lint-ignore no-explicit-any
    settings: { enrichments: {} } as any,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/handler': entry }) as any
  })
}

Deno.test('projection options - each insertion carries its own options through name, file and value', () => {
  const context = buildContext()
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

// Type-level: the call surface follows what the peer declares. Never run.
export const _typeChecks = (
  context: GenerateContextType,
  refName: RefName,
  operation: OasOperation
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

  const handler = new HandlerProjection({
    context,
    operation,
    settings: HandlerProjection.prototype.settings
  })
  handler.insertModel(PetModel, refName, { options: { suffix: 'Input' } })
  // @ts-expect-error options are required when the peer declares them
  handler.insertModel(PetModel, refName)
  handler.insertModel(PlainModel, refName)
}
