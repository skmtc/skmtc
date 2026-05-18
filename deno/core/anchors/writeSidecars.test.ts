import { assert, assertEquals } from '@std/assert'
import { join } from '@std/path'
import { writeSidecars } from './writeSidecars.ts'
import { parseNdjson } from './rollup.ts'
import type { Sidecar } from './sidecar.ts'
import type { RollupEntry } from './rollup.ts'

const baseSidecar = (overrides: Partial<Sidecar> = {}): Sidecar => ({
  v: 2,
  f: 'out.ts',
  src: 'openapi.json',
  parser: 'tsc@5.6.3',
  R: [{ host: 'jsr.io', kind: 'jsr' }],
  G: [{ name: '@scope/gen', version: '0.0.1', r: 0 }],
  S: ['oas:#/components/schemas/X'],
  V: ['main'],
  L: ['X'],
  P: [''],
  A: [[0, 0, 0, 0, 0, 0, 10]],
  ...overrides
})

const withTempDir = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await Deno.makeTempDir({ prefix: 'skmtc-write-sidecars-' })
  try {
    await fn(dir)
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {})
  }
}

Deno.test('writeSidecars - creates outDir + writes one .skm.json per sidecar', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    const result = await writeSidecars({
      sidecars: {
        'src/types/A.generated.ts': baseSidecar({ f: 'src/types/A.generated.ts', L: ['A'] }),
        'src/types/B.generated.ts': baseSidecar({ f: 'src/types/B.generated.ts', L: ['B'] })
      },
      rollup: [],
      outDir
    })

    assertEquals(result.written.length, 3) // 2 sidecars + 1 rollup
    const aText = await Deno.readTextFile(join(outDir, 'src/types/A.generated.ts.skm.json'))
    const a: Sidecar = JSON.parse(aText)
    assertEquals(a.f, 'src/types/A.generated.ts')
    assertEquals(a.L, ['A'])
  })
})

Deno.test('writeSidecars - writes the rollup NDJSON alongside sidecars', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    const rollup: RollupEntry[] = [
      { f: 'a.ts', name: 'A', g: 'gen-x', s: 'oas:#/components/schemas/A', v: 'main' }
    ]
    await writeSidecars({
      sidecars: { 'a.ts': baseSidecar({ f: 'a.ts' }) },
      rollup,
      outDir
    })

    const rollupText = await Deno.readTextFile(join(outDir, '_rollup.ndjson'))
    const parsed = parseNdjson(rollupText)
    assertEquals(parsed, rollup)
  })
})

Deno.test('writeSidecars - empty rollup still writes the file', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    await writeSidecars({
      sidecars: {},
      rollup: [],
      outDir
    })

    const exists = await Deno.lstat(join(outDir, '_rollup.ndjson')).then(() => true).catch(() => false)
    assert(exists, 'expected _rollup.ndjson to exist even when empty')
  })
})

Deno.test('writeSidecars - wholly rewrites the outDir (stale files removed)', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    // First run: write a stale sidecar.
    await writeSidecars({
      sidecars: { 'stale.ts': baseSidecar({ f: 'stale.ts' }) },
      rollup: [],
      outDir
    })
    const staleExisted = await Deno.lstat(join(outDir, 'stale.ts.skm.json'))
      .then(() => true)
      .catch(() => false)
    assert(staleExisted)

    // Second run: a different sidecar. The stale one must be gone.
    await writeSidecars({
      sidecars: { 'fresh.ts': baseSidecar({ f: 'fresh.ts' }) },
      rollup: [],
      outDir
    })
    const staleStill = await Deno.lstat(join(outDir, 'stale.ts.skm.json'))
      .then(() => true)
      .catch(() => false)
    assertEquals(staleStill, false)
    const freshExists = await Deno.lstat(join(outDir, 'fresh.ts.skm.json'))
      .then(() => true)
      .catch(() => false)
    assert(freshExists)
  })
})

Deno.test('writeSidecars - first run on a non-existent outDir succeeds', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, 'never-existed', 'deeper', '.maps')
    const result = await writeSidecars({
      sidecars: { 'a.ts': baseSidecar({ f: 'a.ts' }) },
      rollup: [],
      outDir
    })
    assertEquals(result.written.length, 2)
  })
})

Deno.test('writeSidecars - creates nested directories for deep file paths', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    await writeSidecars({
      sidecars: {
        'a/b/c/d.ts': baseSidecar({ f: 'a/b/c/d.ts' })
      },
      rollup: [],
      outDir
    })

    const text = await Deno.readTextFile(join(outDir, 'a/b/c/d.ts.skm.json'))
    const parsed: Sidecar = JSON.parse(text)
    assertEquals(parsed.f, 'a/b/c/d.ts')
  })
})

Deno.test('writeSidecars - returns total bytes including rollup', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    const result = await writeSidecars({
      sidecars: { 'a.ts': baseSidecar({ f: 'a.ts' }) },
      rollup: [
        { f: 'a.ts', name: 'X', g: 'gen', s: 'oas:#/components/schemas/X', v: 'main' }
      ],
      outDir
    })

    // totalBytes is non-zero and matches actual bytes on disk.
    const sidecarBytes = (await Deno.readTextFile(join(outDir, 'a.ts.skm.json'))).length
    const rollupBytes = (await Deno.readTextFile(join(outDir, '_rollup.ndjson'))).length
    assertEquals(result.totalBytes, sidecarBytes + rollupBytes)
  })
})
