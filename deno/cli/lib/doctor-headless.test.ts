/**
 * Doctor-headless lives in a strange spot for testing: it reads real
 * paths via `toRootPath()` (walks up `cwd` for `.skmtc/`) and the
 * user's home dir (`~/.deno/bin/.skmtc/deno.lock`). To keep tests
 * hermetic we drop into a fresh `Deno.makeTempDir`, build a fake
 * `.skmtc/<project>/` structure, and let `runDoctor` walk the real
 * filesystem against it.
 *
 * `printDoctorResult` is tested separately and doesn't need fs setup.
 */

import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import { runDoctor as runDoctorWithRegistry, type Check } from '@/lib/doctor-headless.ts'
import { printDoctorResult } from '@/commands/doctor.ts'
import { captureStdout } from '@/tests/strict-mode-helpers.test.ts'

/**
 * `runDoctor` with the registry lookup answered as "unreachable" — the
 * checks below are filesystem facts, and a real fetch would make every
 * one of them depend on the network. The registry comparison has its own
 * tests, which state the registry's answer explicitly.
 */
const runDoctor = (
  args: Parameters<typeof runDoctorWithRegistry>[0]
): ReturnType<typeof runDoctorWithRegistry> =>
  runDoctorWithRegistry({
    getLatestCliMeta: () => Promise.resolve(undefined),
    ...args
  })

/**
 * Sets up a temp directory, cd's into it, runs `fn` with the temp dir
 * path, and restores cwd. `toRootPath()` walks up `cwd` looking for
 * `.skmtc/`, so cd'ing into the temp dir is what makes doctor read
 * our fixture instead of the real workspace.
 *
 * `toRootPath` also walks up to `homedir()`, so we need the temp dir
 * to be inside the user's home — `Deno.makeTempDir` defaults to
 * `$TMPDIR` which on macOS is *outside* `$HOME`. We work around that
 * by passing `{ dir: homedir() }` to `makeTempDir`.
 */
const withTempSkmtcRoot = async (fn: (tempRoot: string) => Promise<void>): Promise<void> => {
  const { homedir } = await import('node:os')
  const tempRoot = await Deno.makeTempDir({ dir: homedir(), prefix: 'doctor-test-' })
  await ensureDir(join(tempRoot, '.skmtc'))
  const originalCwd = Deno.cwd()
  Deno.chdir(tempRoot)
  try {
    await fn(tempRoot)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

Deno.test('runDoctor - empty SKMTC root reports zero projects and OK summary', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const result = await runDoctor({ cliVersion: '0.1.5' })
    assertEquals(result.projects, [])
    assertEquals(result.skmtcRootPath, join(tempRoot, '.skmtc'))
    assertEquals(result.cliVersion, '0.1.5')
    // Only the global checks (install-lockfile, deno-version) ran —
    // neither can be `error` here (the test runs against the real
    // homedir, so install-lockfile is `ok` or `skipped`).
    assertEquals(result.summary === 'error', false)
  })
})

Deno.test('runDoctor - flags an absolute basePath as error (friction #13)', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'bad-base-path')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: '/absolute/path' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    assertEquals(result.summary, 'error')
    const basePathCheck = result.checks.find(c => c.id === 'project-base-path/bad-base-path')
    assertEquals(basePathCheck?.status, 'error')
    assertStringIncludes(basePathCheck?.message ?? '', 'absolute basePath')
  })
})

Deno.test('runDoctor - warns on stale-schema manifest (friction #26)', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'stale-manifest')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )
    // Stale-schema manifest: missing parseIssues
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'manifest.json'),
      JSON.stringify({
        deploymentId: 'stale',
        traceId: 'stale',
        spanId: 'stale',
        files: {},
        previews: {},
        results: {},
        startAt: 0,
        endAt: 0
      })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const manifestCheck = result.checks.find(c => c.id === 'project-manifest/stale-manifest')
    assertEquals(manifestCheck?.status, 'warning')
    assertStringIncludes(manifestCheck?.message ?? '', "doesn't match the current")

    // The enrichment check must not double-report a broken manifest —
    // it defers to project-manifest and skips.
    const enrichmentCheck = result.checks.find(c => c.id === 'project-enrichments/stale-manifest')
    assertEquals(enrichmentCheck?.status, 'skipped')
  })
})

/**
 * A minimal manifest that passes the current `manifestContent` schema.
 * `enrichmentWarnings` is spread in per test — absent models a manifest
 * written by a pre-0.28 core.
 */
const validManifest = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    deploymentId: 'run-1',
    traceId: 'trace-1',
    spanId: 'span-1',
    files: {},
    previews: {},
    results: {},
    parseIssues: [],
    startAt: 0,
    endAt: 0,
    ...extra
  })

const writeProjectWithManifest = async (
  tempRoot: string,
  projectName: string,
  manifestJson: string
): Promise<void> => {
  const projectPath = join(tempRoot, '.skmtc', projectName)
  await ensureDir(join(projectPath, '.settings'))
  await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'client.json'),
    JSON.stringify({ settings: { basePath: './src' } })
  )
  await Deno.writeTextFile(join(projectPath, '.settings', 'manifest.json'), manifestJson)
}

Deno.test('runDoctor - surfaces warning-level enrichment warnings from the last manifest', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    await writeProjectWithManifest(
      tempRoot,
      'enrichment-warn',
      validManifest({
        enrichmentWarnings: [
          {
            level: 'warning',
            type: 'UNCONSUMED_ENRICHMENT',
            path: ['@skmtc/gen-shadcn-form', '/pet', 'post'],
            message:
              "enrichment entry '@skmtc/gen-shadcn-form → /pet → post' was never consumed — no matching generator or subject in this run (did you mean '/pets'?)",
            suggestion: '/pets'
          },
          {
            level: 'info',
            type: 'SKIPPED_GENERATOR_ENRICHMENT',
            path: ['@skmtc/gen-msw'],
            message:
              "generator '@skmtc/gen-msw' is skipped in this run — its enrichments were not applied"
          }
        ]
      })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const check = result.checks.find(c => c.id === 'project-enrichments/enrichment-warn')
    assertEquals(check?.status, 'warning')
    assertStringIncludes(check?.message ?? '', '1 enrichment warning(s)')
    assertStringIncludes(check?.message ?? '', "did you mean '/pets'?")
    assertStringIncludes(check?.hint ?? '', 'settings.enrichments')
    // The full list (including info entries) rides `data` for agents.
    const data = check?.data?.enrichmentWarnings
    assertEquals(Array.isArray(data) && data.length === 2, true)
  })
})

Deno.test('runDoctor - clean enrichmentWarnings reports ok', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    await writeProjectWithManifest(
      tempRoot,
      'enrichment-clean',
      validManifest({ enrichmentWarnings: [] })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const check = result.checks.find(c => c.id === 'project-enrichments/enrichment-clean')
    assertEquals(check?.status, 'ok')
  })
})

Deno.test('runDoctor - info-only enrichmentWarnings reports ok with a note', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    await writeProjectWithManifest(
      tempRoot,
      'enrichment-info',
      validManifest({
        enrichmentWarnings: [
          {
            level: 'info',
            type: 'SKIPPED_SUBJECT_ENRICHMENT',
            path: ['@skmtc/gen-shadcn-form', '/pets', 'post', 'main'],
            message:
              "enrichment at '@skmtc/gen-shadcn-form → /pets → post → main' targets a skipped item — it was not applied in this run"
          }
        ]
      })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const check = result.checks.find(c => c.id === 'project-enrichments/enrichment-info')
    assertEquals(check?.status, 'ok')
    assertStringIncludes(check?.message ?? '', '1 info note(s)')
  })
})

Deno.test('runDoctor - manifest without enrichmentWarnings skips with a regenerate hint', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    // No `enrichmentWarnings` at all — a manifest written by a core
    // older than 0.28.0. The field is optional in the schema, so the
    // manifest still validates; the check must say why it can't run.
    await writeProjectWithManifest(tempRoot, 'enrichment-old-core', validManifest())

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const check = result.checks.find(c => c.id === 'project-enrichments/enrichment-old-core')
    assertEquals(check?.status, 'skipped')
    assertStringIncludes(check?.message ?? '', 'predates enrichment warnings')
  })
})

Deno.test('runDoctor - warns when project with local generators has no bundle.js', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'needs-bundle')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@scope/gen-x': './gen-x/mod.ts' // local generator, no jsr:
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const bundleCheck = result.checks.find(c => c.id === 'project-bundle/needs-bundle')
    assertEquals(bundleCheck?.status, 'warning')
    assertStringIncludes(bundleCheck?.message ?? '', 'no bundle.js')
    assertStringIncludes(bundleCheck?.hint ?? '', 'skmtc bundle needs-bundle')
  })
})

Deno.test('runDoctor - reports ok when a project with local generators has a bundle.js', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'has-bundle')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@scope/gen-x': './gen-x/mod.ts' // local generator, no jsr:
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )
    // bundle.js IS present — the check must resolve it. Before the
    // file://-URL-string vs fs-path fix, `existsSync` was handed a
    // `file://` URL string, false-negatived, and reported `warning`.
    await Deno.writeTextFile(join(projectPath, 'bundle.js'), '// bundle')

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const bundleCheck = result.checks.find(c => c.id === 'project-bundle/has-bundle')
    assertEquals(bundleCheck?.status, 'ok')
  })
})

Deno.test('runDoctor - warns when a project with a worker.ts has no @skmtc/worker pin', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'no-worker-pin')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@scope/gen-x': './gen-x/mod.ts' // local generator, no jsr:
        }
      })
    )
    // A generated worker.ts is what makes the missing pin a real
    // problem — it imports '@skmtc/worker', so the next bundle
    // fails to resolve. Pre-bundle projects (no worker.ts) are an
    // ok-noop instead.
    await Deno.writeTextFile(
      join(projectPath, 'worker.ts'),
      "import toWorker from '@skmtc/worker'\n"
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const workerCheck = result.checks.find(c => c.id === 'project-worker-pin/no-worker-pin')
    assertEquals(workerCheck?.status, 'warning')
    assertStringIncludes(workerCheck?.message ?? '', '@skmtc/worker')
  })
})

Deno.test('runDoctor - reports ok when a project pins @skmtc/worker', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'has-worker-pin')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@scope/gen-x': './gen-x/mod.ts',
          '@skmtc/worker': 'jsr:@skmtc/worker@0.3.2'
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const workerCheck = result.checks.find(c => c.id === 'project-worker-pin/has-worker-pin')
    assertEquals(workerCheck?.status, 'ok')
  })
})

Deno.test('runDoctor - warns when Deno is below the `deno bundle` floor', async () => {
  await withTempSkmtcRoot(async () => {
    const result = await runDoctor({ cliVersion: '0.1.5', denoVersion: '2.1.4' })
    const denoCheck = result.checks.find(c => c.id === 'deno-version')
    assertEquals(denoCheck?.status, 'warning')
    assertStringIncludes(denoCheck?.message ?? '', '2.4')
  })
})

Deno.test('runDoctor - accepts a Deno version at or above the floor', async () => {
  await withTempSkmtcRoot(async () => {
    const result = await runDoctor({ cliVersion: '0.1.5', denoVersion: '2.7.0' })
    const denoCheck = result.checks.find(c => c.id === 'deno-version')
    assertEquals(denoCheck?.status, 'ok')
  })
})

Deno.test('runDoctor - warns when project pins an incompatible @skmtc/core (friction #7)', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'stale-core')
    await ensureDir(join(projectPath, '.settings'))
    // Pin an old major.minor — the CLI's pin (read from its own
    // deno.json) is `^0.3.0`, so `^0.0.983` is a clear mismatch.
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@skmtc/core': 'jsr:@skmtc/core@^0.0.983',
          '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.45'
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const pinCheck = result.checks.find(c => c.id === 'project-core-pin/stale-core')
    assertEquals(pinCheck?.status, 'warning')
    assertStringIncludes(pinCheck?.message ?? '', 'Major.minor mismatch')
    assertStringIncludes(pinCheck?.hint ?? '', 'No matching export')
  })
})

Deno.test('runDoctor - warns when project has no @skmtc/core pin at all', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'no-core-pin')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          // No @skmtc/core — `deno bundle` resolves it transitively
          // and you get whatever's hanging around. Doctor flags it.
          '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.45'
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const pinCheck = result.checks.find(c => c.id === 'project-core-pin/no-core-pin')
    assertEquals(pinCheck?.status, 'warning')
    assertStringIncludes(pinCheck?.message ?? '', "doesn't pin @skmtc/core")
  })
})

Deno.test('runDoctor - accepts a matching @skmtc/core pin without warning', async () => {
  // Read the CLI's own pin so the test fixture stays in sync with
  // whatever major.minor `@skmtc/core` is currently at. Hardcoding
  // a version here drifts every time core gets bumped.
  const { readCliCorePin, toMajorMinor } = await import('@/lib/doctor-headless.ts')
  const cliPin = readCliCorePin()
  if (cliPin === null) {
    throw new Error('Cannot read CLI @skmtc/core pin; fixture cannot be built.')
  }
  const cliMajorMinor = toMajorMinor(cliPin)
  if (cliMajorMinor === null) {
    throw new Error(`Cannot parse CLI @skmtc/core pin "${cliPin}".`)
  }

  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'good-pin')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          // Caret-range at the same major.minor as the CLI's own
          // pin — doctor compares major.minor, so this matches
          // however the CLI's version moves over time.
          '@skmtc/core': `jsr:@skmtc/core@^${cliMajorMinor}.0`
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })
    const pinCheck = result.checks.find(c => c.id === 'project-core-pin/good-pin')
    assertEquals(pinCheck?.status, 'ok')
  })
})

Deno.test('runDoctor - remote-only project without a bundle.js gets a warning', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = join(tempRoot, '.skmtc', 'remote-only')
    await ensureDir(join(projectPath, '.settings'))
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.45'
        }
      })
    )
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify({ settings: { basePath: './src' } })
    )

    const result = await runDoctor({ cliVersion: '0.1.5' })

    // Remote-only projects generate from a local bundle.js like
    // any other project — its absence is actionable, not a pass.
    const bundleCheck = result.checks.find(c => c.id === 'project-bundle/remote-only')
    assertEquals(bundleCheck?.status, 'warning')
    assertStringIncludes(bundleCheck?.hint ?? '', 'skmtc bundle')

    // No worker.ts yet → the pin check is an ok-noop (the first
    // `skmtc bundle` writes worker.ts and the pin together).
    const pinCheck = result.checks.find(c => c.id === 'project-worker-pin/remote-only')
    assertEquals(pinCheck?.status, 'ok')
  })
})

Deno.test('printDoctorResult - text format emits one line per check', async () => {
  const logs = await captureStdout(async () => {
    printDoctorResult(
      {
        skmtcRootPath: '/sk',
        globalStateDir: '/home/x/.skmtc',
        cliVersion: '0.1.5',
        projects: ['a', 'b'],
        summary: 'warning',
        checks: [
          { id: 'check-a', status: 'ok', message: 'a is fine' },
          { id: 'check-b', status: 'warning', message: 'b is dubious', hint: 'do this' }
        ]
      },
      { format: 'text' }
    )
  })
  // Header + 4 fields + blank line + 2 check lines + hint line = 9
  const joined = logs.join('\n')
  assertStringIncludes(joined, 'summary: warning')
  assertStringIncludes(joined, '[ok]')
  assertStringIncludes(joined, '[warn]')
  assertStringIncludes(joined, 'hint: do this')
})

Deno.test('printDoctorResult - json format emits a parseable object', async () => {
  const logs = await captureStdout(async () => {
    printDoctorResult(
      {
        skmtcRootPath: '/sk',
        globalStateDir: '/h/.skmtc',
        cliVersion: '0.1.5',
        projects: [],
        summary: 'ok',
        checks: [{ id: 'c', status: 'ok', message: 'ok' }]
      },
      { format: 'json' }
    )
  })
  assertEquals(logs.length, 1)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.summary, 'ok')
  assertEquals(parsed.checks.length, 1)
  assertEquals(parsed.checks[0].id, 'c')
})

Deno.test('runDoctor - hub-auth check reports stored credential shape offline', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    // Point HOME at the temp root so the check reads a hermetic
    // ~/.skmtc/auth.json instead of the operator's real one.
    const originalHome = Deno.env.get('HOME')
    Deno.env.set('HOME', tempRoot)

    try {
      // 1. No auth.json → skipped.
      const noFile = await runDoctor({ cliVersion: '0.0.0' })
      const skipped = noFile.checks.find(check => check.id === 'hub-auth')
      assertEquals(skipped?.status, 'skipped')

      // 2. Malformed file → warning with the logout/login hint.
      await ensureDir(join(tempRoot, '.skmtc'))
      await Deno.writeTextFile(join(tempRoot, '.skmtc', 'auth.json'), 'not json')
      const malformed = await runDoctor({ cliVersion: '0.0.0' })
      const warning = malformed.checks.find(check => check.id === 'hub-auth')
      assertEquals(warning?.status, 'warning')
      assertStringIncludes(warning?.hint ?? '', 'skmtc logout')

      // 3. Valid file → ok; message shows host + last 4 only, never
      //    the full token.
      await Deno.writeTextFile(
        join(tempRoot, '.skmtc', 'auth.json'),
        JSON.stringify({ host: 'https://api.example.test', token: 'skmtc_pat_secret9876' })
      )
      const valid = await runDoctor({ cliVersion: '0.0.0' })
      const ok = valid.checks.find(check => check.id === 'hub-auth')
      assertEquals(ok?.status, 'ok')
      assertStringIncludes(ok?.message ?? '', 'https://api.example.test')
      assertStringIncludes(ok?.message ?? '', '…9876')
      assertEquals((ok?.message ?? '').includes('skmtc_pat_secret9876'), false)
    } finally {
      if (originalHome === undefined) {
        Deno.env.delete('HOME')
      } else {
        Deno.env.set('HOME', originalHome)
      }
    }
  })
})

/** A registry answer: `latest`, and when it was published. */
const toCliMeta = (latest: string, publishedAt?: string) => () =>
  Promise.resolve({
    scope: 'skmtc',
    name: 'cli',
    latest,
    versions: {
      [latest]: publishedAt === undefined ? {} : { createdAt: publishedAt }
    }
  })

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

/**
 * The `cli-version-current` check from a doctor run, taken inside a temp
 * root like every other test here. `toRootPath()` walks up `cwd`, so a
 * run outside `withTempSkmtcRoot` reads whatever `.skmtc` the developer
 * happens to have — passing only because these tests assert on one
 * check, and one malformed manifest in someone's scratch project away
 * from a confusing failure in a check they are not testing.
 *
 * `denoVersion` defaults to a gate-ENFORCING version rather than falling
 * through to the ambient one. Leaving it ambient made the outcome depend
 * on the developer's Deno: `heldBack` flips to false on 2.6-2.8 (the flag
 * parses, nothing is held back) and the flag drops out of the printed
 * command on ≤ 2.5.4 — both inside doctor's own >= 2.4.0 supported range,
 * so the suite passed here and failed for someone one minor behind.
 */
const toVersionCheck = async (
  cliVersion: string,
  getLatestCliMeta: Parameters<typeof runDoctorWithRegistry>[0]['getLatestCliMeta'],
  denoVersion: string = '2.9.4'
): Promise<Check> => {
  const found: Check[] = []
  await withTempSkmtcRoot(async () => {
    const result = await runDoctorWithRegistry({
      cliVersion,
      getLatestCliMeta,
      denoVersion
    })
    const check = result.checks.find(c => c.id === 'cli-version-current')
    if (check === undefined) throw new Error('cli-version-current check missing')
    found.push(check)
  })
  return found[0]
}

Deno.test('runDoctor - cli-version-current is ok on the latest release', async () => {
  const check = await toVersionCheck('0.9.41', toCliMeta('0.9.41', hoursAgo(48)))

  assertEquals(check.status, 'ok')
  assertStringIncludes(check.message, 'latest published')
})

Deno.test('runDoctor - cli-version-current names the age gate for a fresh release', async () => {
  // The silent case: an unpinned `deno install` inside the window
  // resolves the older version and reports success, so doctor has to say
  // why a plain reinstall will not move it.
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(2)))

  assertEquals(check.status, 'warning')
  assertStringIncludes(check.message, '0.9.40 is behind')
  assertStringIncludes(check.hint ?? '', 'minimum-dependency-age')
  assertStringIncludes(check.hint ?? '', '--minimum-dependency-age=0')
  assertStringIncludes(check.hint ?? '', '2 hours ago')
  assertEquals(check.data?.heldBack, true)
})

Deno.test('runDoctor - cli-version-current omits the age note once the window has passed', async () => {
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(72)))

  assertEquals(check.status, 'warning')
  assertEquals(check.data?.heldBack, false)
  assertEquals(check.hint?.includes('window'), false)
  // The flag stays in the command regardless — it is a no-op once the
  // release is old enough, and wrong to drop from a copied command.
  assertStringIncludes(check.hint ?? '', '--minimum-dependency-age=0')
})

Deno.test('runDoctor - cli-version-current accepts a build ahead of the registry', async () => {
  const check = await toVersionCheck('0.10.0', toCliMeta('0.9.41', hoursAgo(48)))

  assertEquals(check.status, 'ok')
  assertStringIncludes(check.message, 'ahead of the published')
})

Deno.test('runDoctor - cli-version-current skips when the registry is unreachable', async () => {
  const check = await toVersionCheck('0.9.40', () => Promise.resolve(undefined))

  assertEquals(check.status, 'skipped')
  // Offline is not a failure: doctor still reports every other check.
  assertStringIncludes(check.message, 'Could not reach')
})

Deno.test('runDoctor - cli-version-current survives a registry answering the wrong shape', async () => {
  // A mirror or proxy behind JSR_URL answering 200 with a JSON error
  // object. Doctor is the "everything else is broken" command, so an
  // unreadable answer must be one `skipped` line, not a throw that takes
  // the other twelve checks with it.
  const check = await toVersionCheck(
    '0.9.40',
    () => Promise.resolve(JSON.parse('{"error":"nope"}'))
  )

  assertEquals(check.status, 'skipped')
})

Deno.test('runDoctor - cli-version-current survives a rejected registry lookup', async () => {
  const check = await toVersionCheck('0.9.40', () =>
    Promise.reject(new Error('socket hang up'))
  )

  assertEquals(check.status, 'skipped')
})

Deno.test('runDoctor - cli-version-current treats a future publish time as inside the window', async () => {
  // A machine whose clock lags the registry by a minute. The release
  // landed moments ago — the deepest part of the window, and the exact
  // case this check exists to explain.
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(-0.02)))

  assertEquals(check.status, 'warning')
  assertEquals(check.data?.heldBack, true)
  assertStringIncludes(check.hint ?? '', 'published a moment ago')
})

Deno.test('runDoctor - cli-version-current tolerates a missing publish time', async () => {
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41'))

  assertEquals(check.status, 'warning')
  assertEquals(check.data?.heldBack, false)
})

Deno.test('runDoctor - cli-version-current names no gate on a Deno that has none', async () => {
  // 2.5.5-2.8 parse the flag but hold nothing back. Naming the window
  // here would explain a cause that does not exist on this runtime, and
  // the command still carries the flag because it is a harmless no-op.
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(2)), '2.7.0')

  assertEquals(check.status, 'warning')
  assertEquals(check.data?.heldBack, false)
  assertEquals(check.hint?.includes('window'), false)
  assertStringIncludes(check.hint ?? '', '--minimum-dependency-age=0')
})

/**
 * Every check id, read out of the source the docs point at. Both
 * spellings appear: a plain literal (`id: 'deno-version'`) for a
 * workspace check, and a template (`id: \`project-bundle/${name}\``)
 * for a per-project one, which the docs write as
 * `project-bundle/<project>`.
 */
const toCheckIds = async (): Promise<string[]> => {
  const sources = ['doctor-headless.ts', 'doctor-anchors.ts']
  const ids = new Set<string>()
  for (const source of sources) {
    const text = await Deno.readTextFile(new URL(source, import.meta.url))
    for (const match of text.matchAll(/\bid = `([a-z-]+)\/\$\{/g)) ids.add(match[1])
    for (const match of text.matchAll(/\bid: `([a-z-]+)\/\$\{/g)) ids.add(match[1])
    for (const match of text.matchAll(/\bid: '([a-z-]+)'/g)) ids.add(match[1])
  }
  return [...ids].sort()
}

Deno.test('runDoctor - --offline says it was skipped by request, not that the network failed', async () => {
  // `--offline` never attempts the lookup, so reporting a connectivity
  // problem would have an agent tell the user about a failure that did
  // not happen — in the command whose value is naming an accurate cause.
  const checks: Check[] = []
  await withTempSkmtcRoot(async () => {
    const result = await runDoctorWithRegistry({
      cliVersion: '0.9.40',
      offline: true,
      getLatestCliMeta: () => {
        throw new Error('the registry must not be consulted')
      }
    })
    const check = result.checks.find(c => c.id === 'cli-version-current')
    if (check === undefined) throw new Error('cli-version-current check missing')
    checks.push(check)
  })

  assertEquals(checks[0].status, 'skipped')
  assertStringIncludes(checks[0].message, 'Skipped by --offline')
  assertEquals(checks[0].message.includes('Could not reach'), false)
})

Deno.test('runDoctor - on a Deno without the gate, the hint neither claims nor prints the flag', async () => {
  // Deno < 2.9 enforces no holdback, and <= 2.5.4 rejects the flag as an
  // unknown argument. Claiming the flag is the fix while handing over a
  // command that omits it is the contradiction to avoid — and doctor's
  // own floor (2.4.0) puts such a reader inside the supported range.
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(2)), '2.5.0')

  assertEquals(check.status, 'warning')
  assertEquals(check.data?.heldBack, false)
  assertEquals(check.hint?.includes('--minimum-dependency-age=0'), false)
})

Deno.test('runDoctor - on a gate-enforcing Deno the hint both claims and prints the flag', async () => {
  const check = await toVersionCheck('0.9.40', toCliMeta('0.9.41', hoursAgo(2)), '2.9.4')

  assertEquals(check.data?.heldBack, true)
  assertStringIncludes(check.hint ?? '', '--minimum-dependency-age=0')
})

Deno.test('doctor - every check id is documented in both catalogues', async () => {
  // The docs are what an agent reads to reason about a check without
  // running it, and two files carry the same table. Adding a check
  // without a row makes it invisible to exactly those readers — which is
  // how `cli-version-current` shipped undocumented in review.
  const catalogues = [
    '../../docs/reference/cli/doctor.md',
    '../../docs/skills/skmtc-cli/reference.md'
  ]
  const ids = await toCheckIds()
  // Guard the guard: a broken extraction would vacuously pass.
  assertEquals(ids.length > 10, true)
  assertEquals(ids.includes('cli-version-current'), true)

  for (const catalogue of catalogues) {
    const text = await Deno.readTextFile(new URL(catalogue, import.meta.url))
    const undocumented = ids.filter(id => !text.includes(`\`${id}`))
    assertEquals(undocumented, [], `undocumented in ${catalogue}`)
  }
})
