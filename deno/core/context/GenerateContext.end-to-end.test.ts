/**
 * End-to-end engine smoke for the variant axis.
 *
 * Spins up a real `GenerateContext` with a real `OasOperationProjectionBase`
 * subclass and a real `toOasOperationEntry` config, runs `toArtifacts`,
 * then inspects each registered `Definition`'s `generatorKey` to
 * confirm the engine fan-out → Driver threading → ContentSettings →
 * static-method → generatorKey path stays wired end-to-end.
 *
 * Most other Driver tests use a mocked `toOperationContentSettings`,
 * which means the Driver and the real `GenerateContext` can drift
 * independently. A regression in either side (e.g. variant getting
 * dropped between `transform` and `Driver.affirmDefinition`) would
 * escape Driver-level unit tests but get caught here.
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import type * as log from '@std/log'
import * as v from 'valibot'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

// The form fixtures store a per-variant subject marker (`{}`) at
// `[id][path][method][variant]`; the composite umbrella parses it as an
// opaque subject leaf, leaving generator/stack absent.
const variantEnrichmentSchema = v.object({
  subject: v.optional(v.unknown()),
  generator: v.optional(v.unknown()),
  stack: v.optional(v.unknown())
})

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const FormBase = toTsOasOperationProjectionBase({
  id: '@test/e2e-form',
  toIdentifierName: ({ variant }) => withVariant('PatchQuoteForm', variant),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ variant }) =>
    `@/forms/${withVariant('PatchQuoteForm', variant)}.tsx`,
  toEnrichmentSchema: () => variantEnrichmentSchema
})

class FormProjection extends FormBase {
  constructor(args: {
    context: GenerateContextType
    operation: OasOperation
    settings: ConstructorParameters<typeof FormBase>[0]['settings']
  }) {
    super(args)
  }

  override toString() {
    return `() => <Form>${this.settings.identifier.name} (variant ${this.settings.variant})</Form>`
  }
}

const buildContext = (variants: Record<string, unknown>) => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({
        path: '/quotes/{id}',
        method: 'patch',
        pathItem: undefined,
        responses: {}
      })
    ]
  })

  const entry = toOasOperationEntry({
    id: '@test/e2e-form',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: FormProjection, operation, variant })
    }
  })

  return new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: {
      enrichments: {
        '@test/e2e-form': {
          '/quotes/{id}': { patch: variants }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/e2e-form': entry } as any)
  })
}

Deno.test('end-to-end - main-only variant: generatorKey carries `main`, output lands in default file', () => {
  const context = buildContext({ main: {} })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const file = files.get('@/forms/PatchQuoteForm.generated.tsx')
  assertExists(file)

  assertInstanceOf(file, CodeFileBase)
  const def = file.findDefinitions({ name: 'PatchQuoteForm' })?.[0]
  assertExists(def)
  // 4-segment OAS GeneratorKey: id|path|method|variant
  assertEquals(def.generatorKey, '@test/e2e-form|/quotes/{id}|patch|main')
})

Deno.test('end-to-end - multi-variant: each Definition carries the right variant in its generatorKey', () => {
  const context = buildContext({ main: {}, customer: {}, location: {} })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const mainFile = files.get('@/forms/PatchQuoteForm.generated.tsx')
  const customerFile = files.get('@/forms/PatchQuoteFormCustomer.generated.tsx')
  const locationFile = files.get('@/forms/PatchQuoteFormLocation.generated.tsx')

  assertExists(mainFile)
  assertExists(customerFile)
  assertExists(locationFile)

  assertInstanceOf(mainFile, CodeFileBase)
  assertInstanceOf(customerFile, CodeFileBase)
  assertInstanceOf(locationFile, CodeFileBase)
  assertEquals(
    mainFile.findDefinitions({ name: 'PatchQuoteForm' })?.[0]?.generatorKey,
    '@test/e2e-form|/quotes/{id}|patch|main'
  )
  assertEquals(
    customerFile.findDefinitions({ name: 'PatchQuoteFormCustomer' })?.[0]?.generatorKey,
    '@test/e2e-form|/quotes/{id}|patch|customer'
  )
  assertEquals(
    locationFile.findDefinitions({ name: 'PatchQuoteFormLocation' })?.[0]?.generatorKey,
    '@test/e2e-form|/quotes/{id}|patch|location'
  )
})

Deno.test('end-to-end - kebab-case variant flows through to generatorKey untouched', () => {
  // The regex allows kebab-case; the engine, Driver, and generatorKey
  // serializer all need to preserve the hyphen exactly. `withVariant`
  // turns `line-items` into `LineItems` for IDENTIFIERS, but the
  // generatorKey carries the variant string raw (post-pipe).
  const context = buildContext({ main: {}, 'line-items': {} })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const lineItemsFile = files.get('@/forms/PatchQuoteFormLineItems.generated.tsx')
  assertExists(lineItemsFile)

  assertInstanceOf(lineItemsFile, CodeFileBase)
  assertEquals(
    lineItemsFile.findDefinitions({ name: 'PatchQuoteFormLineItems' })?.[0]?.generatorKey,
    '@test/e2e-form|/quotes/{id}|patch|line-items'
  )
})
