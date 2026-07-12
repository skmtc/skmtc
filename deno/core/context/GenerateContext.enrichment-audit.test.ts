/**
 * Coverage for the enrichment consumption audit at the engine boundary.
 *
 * Three loud validation layers precede the audit (structural config
 * validation, the per-leaf Valibot parse, the missing-`'main'` throw).
 * What they cannot see is *addressing*: a typo'd generator id, path,
 * method, or model name makes the lookup miss silently. The audit records
 * every enrichment read the engine performs during the walk and flags
 * configured entries no read consumed — surfaced on
 * `GenerateResult.enrichmentWarnings` (and from there the manifest).
 *
 * Invariants exercised here:
 *
 *   1. A clean run — valid enrichments, or none — emits nothing.
 *   2. Typo'd generator id → `UNKNOWN_GENERATOR_ID` (with suggestion).
 *   3. Typo'd path / method-case / model name → `UNCONSUMED_ENRICHMENT`.
 *   4. Orphaned entries (subject no longer in the document) →
 *      `UNCONSUMED_ENRICHMENT`.
 *   5. Skipped items with enrichments → info, never a warning.
 *   6. Reserved keys (`_stack`, `_generator`) are never flagged.
 *
 * Unknown-key detection (the schema-dropped-key half of the surface)
 * lives in `enrichments/parseEnrichmentUmbrella.test.ts`.
 */

import { assertEquals } from '@std/assert'
import { spy, type Spy } from '@std/testing/mock'
import type * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import type { ResultType } from '@/types/Results.ts'
import type { Method } from '@/types/Method.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const makeOasDoc = (args: {
  operations?: Array<{ path: string; method: Method }>
  schemaNames?: string[]
}) =>
  new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: (args.operations ?? []).map(
      ({ path, method }) => new OasOperation({ path, method, pathItem: undefined, responses: {} })
    ),
    components:
      args.schemaNames && args.schemaNames.length > 0
        ? new OasComponents({
            schemas: Object.fromEntries(args.schemaNames.map(name => [name, new OasString({})]))
          })
        : undefined
  })

const buildContext = (args: {
  document: OasDocument
  settings: unknown
  generators: Record<string, unknown>
}) => {
  const captureCurrentResult: Spy<undefined, [ResultType, StackTrail], void> = spy(
    (_result: ResultType, _trail: StackTrail) => {}
  )

  return new GenerateContext({
    document: { type: 'oas', value: args.document },
    // deno-lint-ignore no-explicit-any — settings shape verified at runtime
    settings: args.settings as any,
    logger: mockLogger,
    captureCurrentResult,
    // deno-lint-ignore no-explicit-any — minimal generator mock
    toGeneratorConfigMap: () => args.generators as any
  })
}

const makeOperationGen = (id: string) => ({
  id,
  type: 'oasOperation' as const,
  transform: spy(() => undefined),
  isSupported: () => true
})

const makeModelGen = (id: string) => ({
  id,
  type: 'model' as const,
  transform: spy(() => undefined),
  isSupported: () => true
})

// ─── 1. Clean runs emit nothing ─────────────────────────────────────

Deno.test('enrichment audit - run with no enrichments emits no warnings', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {},
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))
  assertEquals(enrichmentWarnings, [])
})

Deno.test('enrichment audit - correctly addressed enrichments emit no warnings', () => {
  const context = buildContext({
    document: makeOasDoc({
      operations: [{ path: '/pets', method: 'post' }],
      schemaNames: ['User']
    }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pets': { post: { main: { title: 'New Pet' } } }
        },
        'model-gen': {
          User: { main: { readonly: true } }
        }
      }
    },
    generators: {
      'form-gen': makeOperationGen('form-gen'),
      'model-gen': makeModelGen('model-gen')
    }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))
  assertEquals(enrichmentWarnings, [])
})

// ─── 2. Generator-id typo ───────────────────────────────────────────

Deno.test('enrichment audit - typo in generator id warns with a suggestion', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gne': {
          '/pets': { post: { main: { title: 'New Pet' } } }
        }
      }
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  const [warning] = enrichmentWarnings
  assertEquals(warning.type, 'UNKNOWN_GENERATOR_ID')
  assertEquals(warning.level, 'warning')
  assertEquals(warning.path, ['form-gne'])
  assertEquals(warning.suggestion, 'form-gen')
})

// ─── 3. Addressing typos below the generator id ─────────────────────

Deno.test('enrichment audit - typo in operation path warns as unconsumed', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pet': { post: { main: { title: 'New Pet' } } }
        }
      }
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  const [warning] = enrichmentWarnings
  assertEquals(warning.type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(warning.level, 'warning')
  assertEquals(warning.path, ['form-gen', '/pet', 'post'])
  assertEquals(warning.suggestion, '/pets')
})

Deno.test('enrichment audit - wrong method case warns as unconsumed with a suggestion', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pets': { POST: { main: { title: 'New Pet' } } }
        }
      }
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  assertEquals(enrichmentWarnings[0].type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(enrichmentWarnings[0].path, ['form-gen', '/pets', 'POST'])
  assertEquals(enrichmentWarnings[0].suggestion, 'post')
})

Deno.test('enrichment audit - typo in model name warns as unconsumed', () => {
  const context = buildContext({
    document: makeOasDoc({ schemaNames: ['User', 'Order'] }),
    settings: {
      enrichments: {
        'model-gen': {
          Usr: { main: { readonly: true } }
        }
      }
    },
    generators: { 'model-gen': makeModelGen('model-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  assertEquals(enrichmentWarnings[0].type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(enrichmentWarnings[0].path, ['model-gen', 'Usr'])
  assertEquals(enrichmentWarnings[0].suggestion, 'User')
})

// ─── 4. Orphaned entries after spec evolution ───────────────────────

Deno.test('enrichment audit - entry for an operation removed from the document warns as unconsumed', () => {
  // The entry was correct when written; the path has since been renamed
  // in the schema. Rots invisibly without the audit.
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/v2/quotes', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/v1/quotes': { post: { main: { title: 'Quote' } } },
          '/v2/quotes': { post: { main: { title: 'Quote' } } }
        }
      }
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  assertEquals(enrichmentWarnings[0].type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(enrichmentWarnings[0].path, ['form-gen', '/v1/quotes', 'post'])
})

Deno.test('enrichment audit - generator with zero matching subjects collapses to one generator-level warning', () => {
  // The generator is configured and runs, but the document has no
  // subjects of its type — per-entry warnings would fall back to
  // cross-generator "did you mean …?" suggestions, so the audit emits a
  // single generator-level warning with no suggestion instead.
  const context = buildContext({
    document: makeOasDoc({ schemaNames: ['User'] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pets': { post: { main: { title: 'New Pet' } } }
        },
        'model-gen': {
          User: { main: { readonly: true } }
        }
      }
    },
    generators: {
      // A close sibling id that must NOT surface as a suggestion.
      'form-gem': makeOperationGen('form-gem'),
      'form-gen': makeOperationGen('form-gen'),
      'model-gen': makeModelGen('model-gen')
    }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  const [warning] = enrichmentWarnings
  assertEquals(warning.type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(warning.path, ['form-gen'])
  assertEquals(warning.suggestion, undefined)
  assertEquals(
    warning.message,
    "enrichments are configured for 'form-gen' but it matched no subjects in this run — " +
      'its enrichments were never read'
  )
})

// ─── 5. Skip semantics: consumed-with-info ──────────────────────────

Deno.test('enrichment audit - enrichment on a skipped operation is info, not a warning', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pets': { post: { main: { title: 'New Pet' } } }
        }
      },
      skip: [{ 'form-gen': { '/pets': { post: [] } } }]
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  const [info] = enrichmentWarnings
  assertEquals(info.type, 'SKIPPED_SUBJECT_ENRICHMENT')
  assertEquals(info.level, 'info')
  assertEquals(info.path, ['form-gen', '/pets', 'post', 'main'])
})

Deno.test('enrichment audit - enrichments under a wholly skipped generator are info, not warnings', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/pets': { post: { main: { title: 'New Pet' } } }
        }
      },
      skip: ['form-gen']
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  const [info] = enrichmentWarnings
  assertEquals(info.type, 'SKIPPED_GENERATOR_ENRICHMENT')
  assertEquals(info.level, 'info')
  assertEquals(info.path, ['form-gen'])
})

Deno.test('enrichment audit - skipped variant reports info once, other variants stay clean', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/quotes/{id}', method: 'patch' }] }),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: { main: {}, customer: { title: 'Customer' } }
          }
        }
      },
      skip: [{ 'form-gen': { '/quotes/{id}': { patch: ['customer'] } } }]
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(enrichmentWarnings.length, 1)
  assertEquals(enrichmentWarnings[0].type, 'SKIPPED_SUBJECT_ENRICHMENT')
  assertEquals(enrichmentWarnings[0].path, ['form-gen', '/quotes/{id}', 'patch', 'customer'])
})

// ─── 6. Reserved keys are never flagged ─────────────────────────────

Deno.test('enrichment audit - _stack and _generator are never flagged', () => {
  const context = buildContext({
    document: makeOasDoc({ operations: [{ path: '/pets', method: 'post' }] }),
    settings: {
      enrichments: {
        _stack: { theme: 'dark' },
        'form-gen': {
          _generator: { basePackage: 'com.example' }
        }
      }
    },
    generators: { 'form-gen': makeOperationGen('form-gen') }
  })

  const { enrichmentWarnings } = context.toArtifacts(new StackTrail(['test']))
  assertEquals(enrichmentWarnings, [])
})
