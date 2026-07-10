/**
 * Variant-bound `fallbackName` composition through `insertNormalizedModel`.
 *
 * The canonical pattern in `gen-shadcn-form`'s `ShadcnForm.ts`:
 *
 * ```ts
 * this.insertNormalizedModel(TsProjection, {
 *   schema: inlineBodySchema,
 *   fallbackName: `${capitalize(settings.identifier.name)}Body`
 * })
 * ```
 *
 * Because `settings.identifier.name` carries the `withVariant` suffix
 * for variants-aware Projections, the derived `fallbackName`
 * automatically picks up the variant suffix too. Each variant of the
 * form produces a distinct body-model Definition — which is what the
 * consumer wants when two variants edit different field subsets and
 * therefore need different TS body types.
 *
 * This test pins the load-bearing assumption: `settings.identifier.name`
 * flows through `withVariant` BEFORE the form constructor runs, so
 * any derivation from that name in the constructor inherits the
 * variant suffix.
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import * as v from 'valibot'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { createType, defineAndRegister, toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
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

// Variants-aware form Projection: identifier varies per variant.
const FormBase = toTsOasOperationProjectionBase({
  id: '@test/form',
  toIdentifierName: ({ variant }) => withVariant('EditQuotesForm', variant),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ variant }) => `@/forms/${withVariant('EditQuotesForm', variant)}.tsx`,
  toEnrichmentSchema: () => variantEnrichmentSchema
})

class FormProjection extends FormBase {
  bodyName: string

  constructor(args: {
    context: GenerateContextType
    operation: OasOperation
    settings: ConstructorParameters<typeof FormBase>[0]['settings']
  }) {
    super(args)

    // The variant-bound `fallbackName` pattern. `settings.identifier.name`
    // is already `EditQuotesForm` for the 'main' variant and
    // `EditQuotesFormCustomer` for the 'customer' variant — the derived
    // body name picks up the suffix automatically.
    const fallbackName = `${args.settings.identifier.name}Body`

    // Use defineAndRegister directly with a stub value: simulates what
    // insertNormalizedModel does for the inline-schema branch
    // (`projection.schemaToValueFn(...)` produces the body), without
    // pulling a real ModelProjection into the test. The contract we're
    // pinning is the same: the Definition lands under the variant-bound
    // fallbackName at the form's exportPath.
    defineAndRegister(this.context, {
      identifier: createType(fallbackName),
      value: { toString: () => `type ${fallbackName} = { /* body */ }` },
      destinationPath: this.settings.exportPath
    })

    this.bodyName = fallbackName
  }

  override toString() {
    return `() => <Form body=${this.bodyName} />`
  }
}

Deno.test('variant-bound fallbackName - each variant produces a distinct body Definition', () => {
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
    id: '@test/form',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: FormProjection, operation, variant })
    }
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: {
      enrichments: {
        '@test/form': {
          '/quotes/{id}': { patch: { main: {}, customer: {} } }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/form': entry } as any)
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const mainFile = files.get('@/forms/EditQuotesForm.generated.tsx')
  const customerFile = files.get('@/forms/EditQuotesFormCustomer.generated.tsx')

  assertExists(mainFile, 'main-variant file should exist')
  assertExists(customerFile, 'customer-variant file should exist')

  assertInstanceOf(mainFile, CodeFileBase)
  assertInstanceOf(customerFile, CodeFileBase)

  // main file: form + body Definitions, both variant-bound.
  assertExists(mainFile.findDefinitions({ name: 'EditQuotesForm' }))
  assertExists(mainFile.findDefinitions({ name: 'EditQuotesFormBody' }))
  // The 'customer' variant's body must NOT appear in the main file.
  assertEquals(mainFile.findDefinitions({ name: 'EditQuotesFormCustomerBody' }), undefined)

  // customer file: form + body Definitions, both variant-bound.
  assertExists(customerFile.findDefinitions({ name: 'EditQuotesFormCustomer' }))
  assertExists(customerFile.findDefinitions({ name: 'EditQuotesFormCustomerBody' }))
  // The 'main' variant's body must NOT appear in the customer file.
  assertEquals(customerFile.findDefinitions({ name: 'EditQuotesFormBody' }), undefined)
})
