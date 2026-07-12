import { assertEquals } from '@std/assert'
import { EnrichmentAudit, hasVariantEnrichment } from './EnrichmentAudit.ts'
import type { EnrichmentWarning } from './EnrichmentWarning.ts'

const OPERATION_GEN = { id: 'form-gen', type: 'oasOperation' as const }
const MODEL_GEN = { id: 'model-gen', type: 'model' as const }

Deno.test('EnrichmentAudit - report deduplicates on (type, path)', () => {
  const audit = new EnrichmentAudit()

  const warning: EnrichmentWarning = {
    level: 'warning',
    type: 'UNKNOWN_ENRICHMENT_KEY',
    path: ['form-gen', '/pets', 'post', 'main', 'submitLabl'],
    message: 'unknown key'
  }

  // The same lookup repeats once per insert call — the warning must not.
  audit.report(warning)
  audit.report({ ...warning })

  const warnings = audit.finalize({
    enrichments: undefined,
    generators: [OPERATION_GEN],
    skippedGeneratorIds: []
  })

  assertEquals(warnings.length, 1)
})

Deno.test('EnrichmentAudit - insert-only peer slice with consumed reads is not flagged', () => {
  // A peer reached only via insertOperation has no entry of its own, so
  // its id is not in the run's generator set — but its projection statics
  // consumed the slice, which marks it live.
  const audit = new EnrichmentAudit()
  audit.consume(['@peer/gen-query', '/pets', 'post', 'main'])

  const warnings = audit.finalize({
    enrichments: {
      '@peer/gen-query': { '/pets': { post: { main: { staleTime: 5000 } } } }
    },
    generators: [OPERATION_GEN],
    skippedGeneratorIds: []
  })

  assertEquals(warnings, [])
})

Deno.test('EnrichmentAudit - unknown id with no consumed reads is flagged', () => {
  const audit = new EnrichmentAudit()

  const warnings = audit.finalize({
    enrichments: {
      '@peer/gen-query': { '/pets': { post: { main: {} } } }
    },
    generators: [OPERATION_GEN],
    skippedGeneratorIds: []
  })

  assertEquals(warnings.length, 1)
  assertEquals(warnings[0].type, 'UNKNOWN_GENERATOR_ID')
  assertEquals(warnings[0].path, ['@peer/gen-query'])
})

Deno.test('EnrichmentAudit - consumption is prefix-closed', () => {
  // Consuming a leaf marks every ancestor block consumed, so leaf-level
  // reads (projection statics) and block-level reads (dispatch loops)
  // land in one namespace.
  const audit = new EnrichmentAudit()
  audit.consume(['model-gen', 'User', 'main'])

  const warnings = audit.finalize({
    enrichments: { 'model-gen': { User: { main: { readonly: true } } } },
    generators: [MODEL_GEN],
    skippedGeneratorIds: []
  })

  assertEquals(warnings, [])
})

Deno.test('EnrichmentAudit - malformed (non-record) generator slice is left to structural validation', () => {
  const audit = new EnrichmentAudit()
  audit.consume(['form-gen', '/pets', 'post'])

  const warnings = audit.finalize({
    // deno-lint-ignore no-explicit-any -- deliberately malformed
    enrichments: { 'form-gen': 'not-a-record' } as any,
    generators: [OPERATION_GEN],
    skippedGeneratorIds: []
  })

  assertEquals(warnings, [])
})

Deno.test('hasVariantEnrichment - detects declared variants on record blocks only', () => {
  assertEquals(hasVariantEnrichment({ main: {} }, 'main'), true)
  assertEquals(hasVariantEnrichment({ main: {} }, 'customer'), false)
  assertEquals(hasVariantEnrichment(undefined, 'main'), false)
  assertEquals(hasVariantEnrichment('nope', 'main'), false)
  assertEquals(hasVariantEnrichment(['main'], 'main'), false)
})
