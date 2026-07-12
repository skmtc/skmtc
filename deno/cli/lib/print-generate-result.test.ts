import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { printGenerateResult } from '@/lib/print-generate-result.ts'
import type { GenerateLocalResult } from '@/lib/generate-local.ts'
import { captureStdout } from '@/tests/strict-mode-helpers.test.ts'

const baseResult: GenerateLocalResult = {
  stats: {
    tokens: 201029,
    lines: 1234,
    totalTime: 180,
    errors: [],
    files: 3
  },
  parseIssues: [],
  enrichmentWarnings: [],
  filePaths: [
    'src/types/User.generated.ts',
    'src/types/Customer.generated.ts',
    'src/services/useCustomer.generated.ts'
  ],
  protectedPaths: []
}

Deno.test('printGenerateResult - text format includes basePath in summary', async () => {
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: baseResult,
      projectName: 'my-api',
      basePath: 'mobile-app/src',
      manifestPath: '/path/to/manifest.json',
      format: 'text'
    })
  })
  assertEquals(logs.length, 1)
  // Closes friction #14: the basePath is now part of the summary so
  // operators don't have to `find` to locate the output.
  assertStringIncludes(logs[0], 'under mobile-app/src')
  assertStringIncludes(logs[0], '3 files')
})

Deno.test('printGenerateResult - text format omits basePath segment when undefined', async () => {
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: baseResult,
      projectName: 'my-api',
      basePath: undefined,
      manifestPath: '/path/to/manifest.json',
      format: 'text'
    })
  })
  assertEquals(logs.length, 1)
  assertEquals(logs[0].includes('under'), false)
})

Deno.test('printGenerateResult - json format includes file list and manifest path', async () => {
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: baseResult,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '.skmtc/my-api/.settings/manifest.json',
      format: 'json'
    })
  })
  assertEquals(logs.length, 1)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.type, 'generated')
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(parsed.basePath, './src')
  assertEquals(parsed.manifestPath, '.skmtc/my-api/.settings/manifest.json')
  assertEquals(parsed.stats, {
    tokens: 201029,
    lines: 1234,
    files: 3,
    totalTimeMs: 180
  })
  assertEquals(parsed.files.length, 3)
  // The file list is the structured form of friction #14 — agents
  // get the destination paths without re-parsing the manifest.
  assertEquals(parsed.files[0], 'src/types/User.generated.ts')
})

Deno.test('printGenerateResult - json format emits basePath: null when undefined', async () => {
  // `null` rather than missing key keeps the shape stable for
  // consumers — they don't have to handle both "field is null" and
  // "field is absent".
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: baseResult,
      projectName: 'my-api',
      basePath: undefined,
      manifestPath: '/m.json',
      format: 'json'
    })
  })
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.basePath, null)
})

Deno.test('printGenerateResult - json format passes parseIssues through verbatim', async () => {
  // ParseIssue is a documented core type — agents pinning to it
  // expect the same shape they'd see in `manifest.parseIssues`.
  const resultWithIssues: GenerateLocalResult = {
    ...baseResult,
    parseIssues: [
      {
        protocol: 'oas',
        level: 'warning',
        type: 'MISSING_OBJECT_TYPE',
        location: 'components:schemas:User',
        message: 'Object has "properties" property, but is missing type="object" property'
      }
    ]
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: resultWithIssues,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'json'
    })
  })
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.parseIssues.length, 1)
  assertEquals(parsed.parseIssues[0].protocol, 'oas')
  assertEquals(parsed.parseIssues[0].type, 'MISSING_OBJECT_TYPE')
})

Deno.test('printGenerateResult - json format passes enrichmentWarnings through verbatim', async () => {
  // EnrichmentWarning is a documented core type — same shape as
  // `manifest.enrichmentWarnings`. Always present (empty when clean).
  const resultWithWarnings: GenerateLocalResult = {
    ...baseResult,
    enrichmentWarnings: [
      {
        level: 'warning',
        type: 'UNCONSUMED_ENRICHMENT',
        path: ['@skmtc/gen-shadcn-form', '/pet', 'post'],
        message:
          "enrichment entry '@skmtc/gen-shadcn-form → /pet → post' was never consumed — no matching generator or subject in this run (did you mean '/pets'?)",
        suggestion: '/pets'
      }
    ]
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: resultWithWarnings,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'json'
    })
  })
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.enrichmentWarnings.length, 1)
  assertEquals(parsed.enrichmentWarnings[0].type, 'UNCONSUMED_ENRICHMENT')
  assertEquals(parsed.enrichmentWarnings[0].suggestion, '/pets')
})

Deno.test('printGenerateResult - text format lists enrichment warnings after the summary', async () => {
  const resultWithWarnings: GenerateLocalResult = {
    ...baseResult,
    enrichmentWarnings: [
      {
        level: 'warning',
        type: 'UNKNOWN_ENRICHMENT_KEY',
        path: ['@skmtc/gen-shadcn-form', '/pets', 'post', 'main', 'submitLabl'],
        message:
          "unknown enrichment key 'submitLabl' at '@skmtc/gen-shadcn-form → /pets → post → main' — ignored (did you mean 'submitLabel'?)",
        suggestion: 'submitLabel'
      }
    ]
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: resultWithWarnings,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'text'
    })
  })
  assertStringIncludes(logs[0], 'Enrichment warnings (1):')
  assertStringIncludes(logs[0], "did you mean 'submitLabel'?")
})

Deno.test('printGenerateResult - text format suppresses info-only enrichment entries', async () => {
  // Enrichments on deliberately skipped items are a routine state — the
  // text summary must not raise a "warnings" block for them. They still
  // ride --json and the manifest for tooling.
  const resultWithInfo: GenerateLocalResult = {
    ...baseResult,
    enrichmentWarnings: [
      {
        level: 'info',
        type: 'SKIPPED_GENERATOR_ENRICHMENT',
        path: ['@skmtc/gen-shadcn-form'],
        message:
          "generator '@skmtc/gen-shadcn-form' is skipped in this run — its enrichments were not applied"
      }
    ]
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: resultWithInfo,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'text'
    })
  })
  assertEquals(logs[0].includes('Enrichment warnings'), false)
})

Deno.test('printGenerateResult - text format counts only warning-level entries in a mixed list', async () => {
  const mixedResult: GenerateLocalResult = {
    ...baseResult,
    enrichmentWarnings: [
      {
        level: 'info',
        type: 'SKIPPED_SUBJECT_ENRICHMENT',
        path: ['@skmtc/gen-shadcn-form', '/pets', 'post', 'main'],
        message:
          "enrichment at '@skmtc/gen-shadcn-form → /pets → post → main' targets a skipped item — it was not applied in this run"
      },
      {
        level: 'warning',
        type: 'UNCONSUMED_ENRICHMENT',
        path: ['@skmtc/gen-shadcn-form', '/pet', 'post'],
        message:
          "enrichment entry '@skmtc/gen-shadcn-form → /pet → post' was never consumed — no matching generator or subject in this run (did you mean '/pets'?)",
        suggestion: '/pets'
      }
    ]
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: mixedResult,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'text'
    })
  })
  assertStringIncludes(logs[0], 'Enrichment warnings (1):')
  assertEquals(logs[0].includes('targets a skipped item'), false)
})

Deno.test('printGenerateResult - json omits `anchors` field when post-pass did not run', async () => {
  // `anchors` should not appear in the payload at all when undefined,
  // not as `anchors: null` or `anchors: { enabled: false }` — agents
  // can use the field's presence as the "did the post-pass run" signal.
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: baseResult,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'json'
    })
  })
  const parsed = JSON.parse(logs[0])
  assertEquals('anchors' in parsed, false)
})

Deno.test('printGenerateResult - json emits `anchors` block when result.anchors is set', async () => {
  const resultWithAnchors: GenerateLocalResult = {
    ...baseResult,
    anchors: {
      outDir: '/abs/.skmtc/my-api/.maps',
      filesWritten: 4,
      totalBytes: 12345,
      generationMapEntries: 3
    }
  }
  const logs = await captureStdout(async () => {
    printGenerateResult({
      result: resultWithAnchors,
      projectName: 'my-api',
      basePath: './src',
      manifestPath: '/m.json',
      format: 'json'
    })
  })
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.anchors, {
    enabled: true,
    outDir: '/abs/.skmtc/my-api/.maps',
    filesWritten: 4,
    totalBytes: 12345,
    generationMapEntries: 3
  })
})
