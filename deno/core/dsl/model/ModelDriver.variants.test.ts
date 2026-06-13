/**
 * Driver-level coverage for the model-variant axis.
 *
 * Symmetric with `OasOperationDriver.test.ts → "Variant validation"`.
 * Pins two invariants that only show up when a real Driver runs:
 *
 *   1. `assertPeerVariantExists` — non-`main` variants must be
 *      declared in the peer's `enrichments[id][refName]` block,
 *      otherwise the Driver throws at the call site.
 *   2. `affirmDefinition` — a variants-aware Projection whose
 *      `toIdentifier` ignores `variant` collides on its second
 *      variant; the integrity check throws
 *      `"Registered definition mismatch"`.
 */

import { createVariable, toModelProjectionBase } from '@skmtc/lang-typescript'
import { assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const makeDoc = (refNames: string[]) =>
  new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    components: new OasComponents({
      schemas: Object.fromEntries(refNames.map(n => [n, new OasString({})]))
    })
  })

const makeContext = (args: { document: OasDocument; settings: unknown }) => {
  // The config map stays EMPTY: the Driver reads the peer's `Lang` off the
  // projection class's static (inherited from `TsSnippet` through the lang
  // veneer), so inserted generators need no config-map entry.
  return new GenerateContext({
    document: { type: 'oas', value: args.document },
    // deno-lint-ignore no-explicit-any
    settings: args.settings as any,
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

// ─── assertPeerVariantExists ─────────────────────────────────────

Deno.test(
  'ModelDriver - insertModel with non-main variant for unconfigured peer throws',
  () => {
    const ZodVariants = class extends toModelProjectionBase({
      id: '@scope/gen-zod-variants',
      toIdentifierName: ({ refName, variant }) => withVariant(refName, variant),
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName, variant }) => `@/schemas/${withVariant(refName, variant)}.ts`
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {} // No enrichments at all
    })

    assertThrows(
      () => context.insertModel(ZodVariants, 'Customer' as RefName, { variant: 'coercive' }),
      Error,
      `Cannot insert variant 'coercive' for 'Customer'`
    )
  }
)

Deno.test(
  'ModelDriver - insertModel with non-main variant absent from peer enrichments throws',
  () => {
    const ZodVariants = class extends toModelProjectionBase({
      id: '@scope/gen-zod-variants',
      toIdentifierName: ({ refName, variant }) => withVariant(refName, variant),
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName, variant }) => `@/schemas/${withVariant(refName, variant)}.ts`
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {
        enrichments: {
          '@scope/gen-zod-variants': {
            Customer: {
              main: {} // 'coercive' not declared
            }
          }
        }
      }
    })

    assertThrows(
      () => context.insertModel(ZodVariants, 'Customer' as RefName, { variant: 'coercive' }),
      Error,
      `Available variants: main`
    )
  }
)

Deno.test(
  'ModelDriver - insertModel with main variant on a peer with no enrichments succeeds',
  () => {
    // `'main'` is universally safe — it's the canonical default and
    // always permitted regardless of the peer's enrichment shape.
    const ZodGen = class extends toModelProjectionBase({
      id: '@scope/gen-zod',
      toIdentifierName: ({ refName }) => refName,
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName }) => `@/schemas/${refName}.ts`
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {}
    })

    // Should not throw.
    const inserted = context.insertModel(ZodGen, 'Customer' as RefName)
    assertEquals(inserted.toName(), 'Customer')
  }
)

// ─── affirmDefinition / generatorKey collision ────────────────────

Deno.test(
  'ModelDriver - variants-aware Projection that forgets to vary toIdentifier collides on second variant',
  () => {
    // BROKEN: toIdentifier ignores `variant`. Two variants of the
    // same refName produce the same identifier name and same export
    // path, but their `generatorKey`s differ (Driver folds variant
    // into the key). On the second insertion, `findDefinition` hits
    // the cached entry for variant 'main' but the new generatorKey
    // doesn't match — integrity check throws.
    const BrokenZod = class extends toModelProjectionBase({
      id: '@scope/gen-broken-zod',
      toIdentifierName: ({ refName }) => refName, // ← ignores variant
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName }) => `@/schemas/${refName}.ts`          // ← ignores variant
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {
        enrichments: {
          '@scope/gen-broken-zod': {
            Customer: {
              main: {},
              coercive: {}
            }
          }
        }
      }
    })

    // First insertion (main) succeeds and registers the Definition.
    context.insertModel(BrokenZod, 'Customer' as RefName, { variant: 'main' })

    // Second insertion (coercive) hits the cache for the same
    // (name, exportPath) pair but its generatorKey ends in
    // `|coercive` vs cached `|main` — affirmDefinition throws.
    assertThrows(
      () => context.insertModel(BrokenZod, 'Customer' as RefName, { variant: 'coercive' }),
      Error,
      'Registered definition mismatch'
    )
  }
)

Deno.test(
  'ModelDriver - variants-aware Projection that varies toIdentifier produces distinct Definitions',
  () => {
    // CORRECT: toIdentifier folds variant into the name via
    // `withVariant`, and toExportPath inherits the variant suffix.
    // Two variants of the same refName produce distinct (name,
    // exportPath) cache keys and therefore distinct Definitions.
    const CorrectZod = class extends toModelProjectionBase({
      id: '@scope/gen-correct-zod',
      toIdentifierName: ({ refName, variant }) => withVariant(refName, variant),
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName, variant }) => `@/schemas/${withVariant(refName, variant)}.ts`
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {
        enrichments: {
          '@scope/gen-correct-zod': {
            Customer: {
              main: {},
              coercive: {}
            }
          }
        }
      }
    })

    const main = context.insertModel(CorrectZod, 'Customer' as RefName, { variant: 'main' })
    const coercive = context.insertModel(CorrectZod, 'Customer' as RefName, {
      variant: 'coercive'
    })

    assertEquals(main.toName(), 'Customer')
    assertEquals(coercive.toName(), 'CustomerCoercive')
    assertEquals(main.settings.exportPath, '@/schemas/Customer.ts')
    assertEquals(coercive.settings.exportPath, '@/schemas/CustomerCoercive.ts')
    // Distinct Definitions.
    assertEquals(main.definition === coercive.definition, false)
  }
)

Deno.test(
  'ModelDriver - same variant twice on a correct Projection hits the cache',
  () => {
    const Zod = class extends toModelProjectionBase({
      id: '@scope/gen-cache-zod',
      toIdentifierName: ({ refName }) => refName,
      toIdentifierType: () => ({ kind: 'variable' }),
      toExportPath: ({ refName }) => `@/schemas/${refName}.ts`
    }) {
      // deno-lint-ignore no-explicit-any — test stub; insertNormalizedModel isn't exercised
      static schemaToValueFn: any = () => ({ toString: () => '' })
      static createIdentifier = createVariable
      override toString() {
        return `z.object({})`
      }
    }

    const context = makeContext({
      document: makeDoc(['Customer']),
      settings: {}
    })

    const first = context.insertModel(Zod, 'Customer' as RefName)
    const second = context.insertModel(Zod, 'Customer' as RefName)
    // Same Definition reference.
    assertEquals(first.definition === second.definition, true)
  }
)
