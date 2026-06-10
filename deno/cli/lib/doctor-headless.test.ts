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
import { runDoctor } from '@/lib/doctor-headless.ts'
import { printDoctorResult } from '@/commands/doctor.ts'
import { captureStdout } from '@/tests/strict-mode-helpers.test.ts'

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
const withTempSkmtcRoot = async (
  fn: (tempRoot: string) => Promise<void>
): Promise<void> => {
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

Deno.test(
  'runDoctor - flags an absolute basePath as error (friction #13)',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - warns on stale-schema manifest (friction #26)',
  async () => {
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
    })
  }
)

Deno.test(
  'runDoctor - warns when project with local generators has no bundle.js',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - reports ok when a project with local generators has a bundle.js',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - warns when a project with a worker.ts has no @skmtc/worker pin',
  async () => {
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
  }
)

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

Deno.test(
  'runDoctor - warns when project pins an incompatible @skmtc/core (friction #7)',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - warns when project has no @skmtc/core pin at all',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - accepts a matching @skmtc/core pin without warning',
  async () => {
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
  }
)

Deno.test(
  'runDoctor - remote-only project without a bundle.js gets a warning',
  async () => {
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
  }
)

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
