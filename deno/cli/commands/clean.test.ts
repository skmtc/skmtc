import { assertEquals, assertStringIncludes } from '@std/assert'
import { printCleanResult, renderClean } from './clean.ts'
import type { CleanHeadlessResult } from '@/lib/clean-headless.ts'
import { withCapturedExit } from '@/tests/strict-mode-helpers.test.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'

const captureLogs = (fn: () => void): string[] => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg?: unknown) => logs.push(String(msg ?? ''))
  try {
    fn()
  } finally {
    console.log = original
  }
  return logs
}

const baseResult: CleanHeadlessResult = {
  projectName: 'my-api',
  dryRun: false,
  deleted: ['src/gen/User.ts', 'src/gen/api.ts'],
  missing: [],
  skipped: [],
  ejected: [],
  modified: [],
  removedDirs: [],
  manifestRemoved: true,
  noManifest: false
}

Deno.test('printCleanResult - text reports counts + manifest removal', () => {
  const logs = captureLogs(() => printCleanResult(baseResult, { format: 'text', verbose: false }))
  assertEquals(logs[0], 'Deleted 2 generated file(s) for "my-api".')
  assertEquals(logs.includes('Removed manifest.'), true)
})

Deno.test('printCleanResult - verbose lists files and pruned dirs', () => {
  const result: CleanHeadlessResult = { ...baseResult, removedDirs: ['src/gen/types'] }
  const logs = captureLogs(() => printCleanResult(result, { format: 'text', verbose: true }))
  const joined = logs.join('\n')
  assertStringIncludes(joined, 'src/gen/User.ts')
  assertStringIncludes(joined, 'src/gen/api.ts')
  assertStringIncludes(joined, 'src/gen/types/')
})

Deno.test('printCleanResult - text reports dir, missing and skipped counts', () => {
  const result: CleanHeadlessResult = {
    ...baseResult,
    removedDirs: ['src/gen/types'],
    missing: ['src/gen/Gone.ts'],
    skipped: ['../evil.ts']
  }
  const logs = captureLogs(() => printCleanResult(result, { format: 'text', verbose: false }))
  const joined = logs.join('\n')
  assertStringIncludes(joined, 'removed 1 empty director')
  assertStringIncludes(joined, '1 already absent')
  assertStringIncludes(joined, '1 refused')
})

Deno.test('printCleanResult - dry run says nothing was deleted', () => {
  const result: CleanHeadlessResult = {
    ...baseResult,
    dryRun: true,
    manifestRemoved: false,
    removedDirs: ['src/gen/types']
  }
  const logs = captureLogs(() => printCleanResult(result, { format: 'text', verbose: false }))
  const joined = logs.join('\n')
  assertStringIncludes(joined, 'Would delete 2 generated file(s)')
  assertStringIncludes(joined, 'would remove 1 empty director')
  assertStringIncludes(joined, 'Dry run — nothing was deleted')
  assertEquals(joined.includes('Removed manifest.'), false)
})

Deno.test('printCleanResult - noManifest prints a no-op message', () => {
  const result: CleanHeadlessResult = {
    projectName: 'my-api',
    dryRun: false,
    deleted: [],
    missing: [],
    skipped: [],
    ejected: [],
    modified: [],
    removedDirs: [],
    manifestRemoved: false,
    noManifest: true
  }
  const logs = captureLogs(() => printCleanResult(result, { format: 'text', verbose: false }))
  assertEquals(logs.length, 1)
  assertStringIncludes(logs[0], 'Nothing to clean for "my-api"')
})

Deno.test('printCleanResult - json emits a single parseable object', () => {
  const logs = captureLogs(() => printCleanResult(baseResult, { format: 'json', verbose: false }))
  assertEquals(logs.length, 1)
  const parsed: CleanHeadlessResult = JSON.parse(logs[0])
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(parsed.deleted.length, 2)
  assertEquals(parsed.manifestRemoved, true)
})

Deno.test('renderClean - missing project fails with recipe', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderClean({ projectName: undefined })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <project>')
  assertStringIncludes(errors[0], 'ls .skmtc/')
})

Deno.test('renderClean - unknown project fails with recipe', async () => {
  const skmtcRoot = createMockSkmtcRoot(createMockManager(), { projects: [] })
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderClean({ projectName: 'nope', skmtcRoot })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <project>')
  assertStringIncludes(errors[0], 'ls .skmtc/')
})
