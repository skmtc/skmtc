/**
 * `NormalizedModelProjection.toDeclaration` — the optional static that
 * answers the DECLARATION question directly.
 *
 * The default inline path assumes a value renders identically in type
 * position and as a declaration body (true for TypeScript). Languages
 * with a head+value declaration model (Kotlin) provide `toDeclaration`
 * so identifier kind and value are decided together by the projection
 * that owns both — the engine must use BOTH answers and never fall back
 * to `createIdentifier`/`schemaToValueFn` when the hook is present.
 */
import { assertEquals, assertExists, assertStringIncludes } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasString } from '@/oas/string/String.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import {
  createVariable,
  toTsModelProjectionBase,
  toTsOasOperationProjectionBase
} from '@skmtc/lang-typescript'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// A model projection whose toDeclaration answers with a DIFFERENT
// identifier kind and value than the default path would produce — so the
// test can tell which path ran.
const PeerBase = toTsModelProjectionBase({
  id: '@test/peer',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/models/peer.generated.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PeerProjection extends PeerBase {
  override toString() {
    return 'unused'
  }

  static schemaToValueFn = () => 'TYPE_POSITION_VALUE'
  static createIdentifier = (name: string) => createVariable(name)
  static toDeclaration = ({ name }: { name: string }) => ({
    identifier: createVariable(name, { typeName: 'DeclaredKind' }),
    value: 'DECLARATION_VALUE'
  })
}

const ConsumerBase = toTsOasOperationProjectionBase({
  id: '@test/consumer',
  toIdentifierName: () => 'consumer',
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/services/consumer.generated.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class ConsumerProjection extends ConsumerBase {
  bodyName: string

  constructor(args: ConstructorParameters<typeof ConsumerBase>[0]) {
    super(args)

    const inlineBody = new OasObject({ properties: { id: new OasString({}) } })

    // deno-lint-ignore no-explicit-any
    const definition = this.context.insertNormalizedModel(PeerProjection as any, {
      schema: inlineBody,
      fallbackName: 'ConsumerBody',
      destinationPath: this.settings.exportPath
    })

    this.bodyName = definition.identifier.name
  }

  override toString() {
    return `use(${this.bodyName})`
  }
}

Deno.test('insertNormalizedModel uses toDeclaration when the projection provides it', () => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({ path: '/things', method: 'post', pathItem: undefined, responses: {} })
    ]
  })

  const entry = toOasOperationEntry({
    id: '@test/consumer',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation }) => {
      context.insertOperation({ projection: ConsumerProjection, operation })
    }
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/consumer': entry }) as any
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const consumerFile = files.get('@/services/consumer.generated.ts')
  assertExists(consumerFile)

  const rendered = consumerFile.toString()

  // Identifier and value both came from the hook — never the defaults.
  assertStringIncludes(rendered, 'ConsumerBody: DeclaredKind = DECLARATION_VALUE')
  assertEquals(rendered.includes('TYPE_POSITION_VALUE'), false)
})
