/**
 * Tests for the three gen-maps doctor checks. Uses the same temp-cwd
 * pattern as `doctor-headless.test.ts` — `toRootPath()` walks `cwd`
 * looking for `.skmtc/`, so each test builds a fixture and `cd`'s
 * into the temp dir.
 *
 * Each check has explicit unit-style coverage rather than going
 * through the full `runDoctor` pipeline — keeps the failures
 * specific.
 */

import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import {
  checkAnchorsConfig,
  checkAnchorsCoverage,
  checkAnchorsStaleness
} from '@/lib/doctor-anchors.ts'

const withTempSkmtcRoot = async (fn: (tempRoot: string) => Promise<void>): Promise<void> => {
  const { homedir } = await import('node:os')
  const tempRoot = await Deno.makeTempDir({ dir: homedir(), prefix: 'doctor-anchors-' })
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

const setupProject = async (
  tempRoot: string,
  projectName: string,
  clientJson?: unknown
): Promise<string> => {
  const projectPath = join(tempRoot, '.skmtc', projectName)
  await ensureDir(join(projectPath, '.settings'))
  if (clientJson !== undefined) {
    await Deno.writeTextFile(
      join(projectPath, '.settings', 'client.json'),
      JSON.stringify(clientJson)
    )
  }
  return projectPath
}

const writeManifest = async (
  projectPath: string,
  files: Record<string, { destinationPath: string }>
): Promise<void> => {
  const manifest = {
    deploymentId: 'test',
    traceId: 't',
    spanId: 's',
    files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, { ...v, lines: 1, characters: 1 }])
    ),
    previews: {},
    results: { trace: [], span: [], step: [], items: {} },
    parseIssues: [],
    startAt: Date.now(),
    endAt: Date.now()
  }
  await Deno.writeTextFile(
    join(projectPath, '.settings', 'manifest.json'),
    JSON.stringify(manifest)
  )
}

// ─── checkAnchorsConfig ────────────────────────────────────────────

Deno.test('checkAnchorsConfig - no client.json → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', undefined)
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'skipped')
    assertStringIncludes(check.message, 'no client.json')
  })
})

Deno.test('checkAnchorsConfig - client.json without anchors block → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', { settings: { basePath: 'src' } })
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'skipped')
    assertStringIncludes(check.message, 'no anchors config')
  })
})

Deno.test('checkAnchorsConfig - anchors disabled → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: false } }
    })
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'skipped')
    assertStringIncludes(check.message, 'enabled: false')
  })
})

Deno.test('checkAnchorsConfig - anchors enabled → ok with default out', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'ok')
    assertEquals(check.data, { enabled: true, out: '.maps' })
  })
})

Deno.test('checkAnchorsConfig - anchors enabled with custom out → ok', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true, out: '.gen-maps' } }
    })
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'ok')
    assertEquals(check.data?.out, '.gen-maps')
  })
})

Deno.test('checkAnchorsConfig - malformed anchors block → warning', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: 'yes' } } // wrong type
    })
    const check = checkAnchorsConfig('p', projectPath)
    assertEquals(check.status, 'warning')
    assertStringIncludes(check.message, "doesn't match")
  })
})

// ─── checkAnchorsCoverage ──────────────────────────────────────────

Deno.test('checkAnchorsCoverage - anchors disabled → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: false } }
    })
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'skipped')
  })
})

Deno.test('checkAnchorsCoverage - no manifest → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'skipped')
    assertStringIncludes(check.message, 'no manifest')
  })
})

Deno.test('checkAnchorsCoverage - all sidecars present → ok', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    await writeManifest(projectPath, {
      'src/A.ts': { destinationPath: '/abs/src/A.ts' },
      'src/B.ts': { destinationPath: '/abs/src/B.ts' }
    })
    // Create matching sidecars under .maps/.
    const outDir = join(projectPath, '.maps')
    await ensureDir(join(outDir, 'src'))
    await Deno.writeTextFile(join(outDir, 'src/A.ts.skm.json'), '{}')
    await Deno.writeTextFile(join(outDir, 'src/B.ts.skm.json'), '{}')
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'ok')
    assertEquals(check.data?.coverage, 1)
  })
})

Deno.test('checkAnchorsCoverage - half coverage → warning', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    await writeManifest(projectPath, {
      'A.ts': { destinationPath: '/abs/A.ts' },
      'B.ts': { destinationPath: '/abs/B.ts' }
    })
    const outDir = join(projectPath, '.maps')
    await ensureDir(outDir)
    await Deno.writeTextFile(join(outDir, 'A.ts.skm.json'), '{}')
    // B.ts.skm.json deliberately missing.
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'warning')
    assertEquals(check.data?.covered, 1)
    assertEquals(check.data?.total, 2)
  })
})

Deno.test('checkAnchorsCoverage - empty manifest files list → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    await writeManifest(projectPath, {})
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'skipped')
    assertStringIncludes(check.message, 'lists no files')
  })
})

Deno.test('checkAnchorsCoverage - honours custom anchors.out', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true, out: '.gen-maps' } }
    })
    await writeManifest(projectPath, {
      'A.ts': { destinationPath: '/abs/A.ts' }
    })
    const outDir = join(projectPath, '.gen-maps')
    await ensureDir(outDir)
    await Deno.writeTextFile(join(outDir, 'A.ts.skm.json'), '{}')
    const check = checkAnchorsCoverage('p', projectPath)
    assertEquals(check.status, 'ok')
  })
})

// ─── checkAnchorsStaleness ─────────────────────────────────────────

Deno.test('checkAnchorsStaleness - anchors disabled → skipped', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: false } }
    })
    const check = checkAnchorsStaleness('p', projectPath)
    assertEquals(check.status, 'skipped')
  })
})

Deno.test('checkAnchorsStaleness - all sidecars at-or-after file mtime → ok', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    // Write the file first, then the sidecar — sidecar is newer.
    const filePath = join(tempRoot, 'A.ts')
    await Deno.writeTextFile(filePath, 'export const A = 1')
    await writeManifest(projectPath, {
      'A.ts': { destinationPath: filePath }
    })
    const outDir = join(projectPath, '.maps')
    await ensureDir(outDir)
    // Ensure the sidecar's mtime is strictly later than the file's.
    await new Promise(r => setTimeout(r, 10))
    await Deno.writeTextFile(join(outDir, 'A.ts.skm.json'), '{}')
    const check = checkAnchorsStaleness('p', projectPath)
    assertEquals(check.status, 'ok')
  })
})

Deno.test('checkAnchorsStaleness - file newer than sidecar → warning', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    const filePath = join(tempRoot, 'A.ts')
    const outDir = join(projectPath, '.maps')
    await ensureDir(outDir)
    // Write the sidecar first, wait, then write the file — file mtime
    // is strictly later.
    await Deno.writeTextFile(join(outDir, 'A.ts.skm.json'), '{}')
    await new Promise(r => setTimeout(r, 10))
    await Deno.writeTextFile(filePath, 'export const A = 1')
    await writeManifest(projectPath, {
      'A.ts': { destinationPath: filePath }
    })
    const check = checkAnchorsStaleness('p', projectPath)
    assertEquals(check.status, 'warning')
    assertEquals((check.data?.stale as string[]).includes('A.ts'), true)
  })
})

Deno.test('checkAnchorsStaleness - missing sidecar is ignored (coverage handles it)', async () => {
  await withTempSkmtcRoot(async tempRoot => {
    const projectPath = await setupProject(tempRoot, 'p', {
      settings: { anchors: { enabled: true } }
    })
    const filePath = join(tempRoot, 'A.ts')
    await Deno.writeTextFile(filePath, 'export const A = 1')
    await writeManifest(projectPath, {
      'A.ts': { destinationPath: filePath }
    })
    // No sidecar at all — staleness can't be evaluated; the coverage
    // check is responsible for surfacing the absence.
    const check = checkAnchorsStaleness('p', projectPath)
    assertEquals(check.status, 'ok')
  })
})
