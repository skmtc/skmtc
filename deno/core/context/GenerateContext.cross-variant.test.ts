/**
 * Cross-variant peer composition.
 *
 * The actual user-visible value of the variant axis: two variants of
 * a variants-aware Projection share their variants-unaware peer's
 * Definition (cache hit on the second variant) while each variant's
 * file gets its own import to that peer.
 *
 * Concretely: if `EditQuotesForm` has variants `main` and `customer`,
 * each variant produces its own file (`@/forms/EditQuotesForm.tsx`
 * and `@/forms/EditQuotesFormCustomer.tsx`). Both files reference the
 * same TanstackQuery client hook — the peer Definition is registered
 * exactly once in `@/services/usePatchQuote.ts`, and both form files
 * have an import line pointing at it.
 *
 * This invariant lives downstream of:
 *   - `OasOperationProjectionBase.insertOperation` not accepting a
 *     variant option (defaults `'main'` on the peer).
 *   - The Driver's `findDefinition` cache being keyed on
 *     `(name, exportPath)` so `(usePatchQuote, queries.ts)` collides
 *     for both form variants.
 *   - Import auto-registration firing for every cross-file call
 *     regardless of cache hit.
 *
 * If any of those break, two variants of a form duplicate the peer
 * Definition and the consumer ships a doubled symbol.
 */

import { assertEquals, assertExists, assertInstanceOf, assertStringIncludes } from '@std/assert'
import type * as log from '@std/log'
import * as v from 'valibot'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// The form fixtures store a per-variant subject marker (`{}`) at
// `[id][path][method][variant]`; the composite umbrella parses it as an
// opaque subject leaf, leaving generator/stack absent.
const variantEnrichmentSchema = v.object({
  subject: v.optional(v.unknown()),
  generator: v.optional(v.unknown()),
  stack: v.optional(v.unknown())
})

const PATH = '/quotes/{id}'
const METHOD = 'patch' as const

// Variants-unaware peer — a stand-in for TanstackQuery / TsProjection.
// Its `toIdentifier` does NOT consult `variant`, so two variants of
// the form caller hit the same (name, exportPath) cache key.
const PeerBase = toTsOasOperationProjectionBase({
  id: '@test/peer-gen',
  toIdentifierName: () => 'usePatchQuote',
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/services/usePatchQuote.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PeerProjection extends PeerBase {
  override toString() {
    return `() => fetch('${PATH}', { method: '${METHOD}' })`
  }
}

// Variants-aware form — its `toIdentifier` uses `withVariant` so the
// two variants produce distinct (name, exportPath) pairs and each
// gets its own file.
const FormBase = toTsOasOperationProjectionBase({
  id: '@test/form-gen',
  toIdentifierName: ({ variant }) => withVariant('EditQuotesForm', variant),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ variant }) => `@/forms/${withVariant('EditQuotesForm', variant)}.tsx`,
  toEnrichmentSchema: () => variantEnrichmentSchema
})

class FormProjection extends FormBase {
  peerName: string

  constructor(
    args: {
      context: GenerateContextType
      operation: OasOperation
      settings: ConstructorParameters<typeof FormBase>[0]['settings']
    }
  ) {
    super(args)

    // Compose with the variants-unaware peer. No `variant` argument
    // means the Driver defaults to `'main'` — both form variants hit
    // the same peer cache key and share the Definition.
    this.peerName = this.insertOperation(PeerProjection, args.operation).toName()
  }

  override toString() {
    return `() => <Form><Hook name="${this.peerName}" /></Form>`
  }
}

Deno.test('cross-variant - peer Definition is registered exactly once across two form variants', () => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [new OasOperation({ path: PATH, method: METHOD, pathItem: undefined, responses: {} })]
  })

  const formEntry = toOasOperationEntry({
    id: '@test/form-gen',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: FormProjection, operation, variant })
    }
  })

  const peerEntry = toOasOperationEntry({
    id: '@test/peer-gen',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: () => {}
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: {
      enrichments: {
        '@test/form-gen': {
          [PATH]: { [METHOD]: { main: {}, customer: {} } }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () =>
      // deno-lint-ignore no-explicit-any
      ({ '@test/form-gen': formEntry, '@test/peer-gen': peerEntry } as any)
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  // Three files registered: the peer file plus one per variant.
  const peerFile = files.get('@/services/usePatchQuote.ts')
  const mainFile = files.get('@/forms/EditQuotesForm.tsx')
  const customerFile = files.get('@/forms/EditQuotesFormCustomer.tsx')

  assertExists(peerFile, 'Peer file should exist')
  assertExists(mainFile, 'main-variant form file should exist')
  assertExists(customerFile, 'customer-variant form file should exist')

  // Peer Definition registered exactly once — both form variants
  // hit the same cache key.
  assertInstanceOf(peerFile, CodeFileBase)
  const peerDefinitions = peerFile.findDefinitions()
  assertExists(peerDefinitions)
  assertEquals(
    peerDefinitions.length,
    1,
    `Peer file should have exactly one Definition, got: ${peerDefinitions
      .map(definition => definition.identifier.name)
      .join(', ')}`
  )
  assertEquals(peerDefinitions[0].identifier.name, 'usePatchQuote')
})

Deno.test('cross-variant - both form variants import from the shared peer file', () => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [new OasOperation({ path: PATH, method: METHOD, pathItem: undefined, responses: {} })]
  })

  const formEntry = toOasOperationEntry({
    id: '@test/form-gen',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: FormProjection, operation, variant })
    }
  })

  const peerEntry = toOasOperationEntry({
    id: '@test/peer-gen',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: () => {}
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: {
      enrichments: {
        '@test/form-gen': {
          [PATH]: { [METHOD]: { main: {}, customer: {} } }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () =>
      // deno-lint-ignore no-explicit-any
      ({ '@test/form-gen': formEntry, '@test/peer-gen': peerEntry } as any)
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const mainFile = files.get('@/forms/EditQuotesForm.tsx')
  const customerFile = files.get('@/forms/EditQuotesFormCustomer.tsx')
  assertExists(mainFile)
  assertExists(customerFile)

  // Each form-variant file has an import of `usePatchQuote` from the
  // peer file. The Driver auto-registers this import whenever the
  // peer's exportPath differs from the caller's destinationPath.
  assertInstanceOf(mainFile, CodeFileBase)
  assertStringIncludes(
    mainFile.toString(),
    `import {usePatchQuote} from '@/services/usePatchQuote.ts'`,
    'main-variant file should import from peer file'
  )

  assertInstanceOf(customerFile, CodeFileBase)
  assertStringIncludes(
    customerFile.toString(),
    `import {usePatchQuote} from '@/services/usePatchQuote.ts'`,
    'customer-variant file should import from peer file'
  )
})
