import { assert, assertEquals } from '@std/assert'
import { join } from '@std/path'
import { writeSidecars } from './writeSidecars.ts'
import { parseNdjson } from './generationMap.ts'
import type { Sidecar } from './sidecar.ts'
import type { GenerationMapEntry } from './generationMap.ts'

const baseSidecar = (overrides: Partial<Sidecar> = {}): Sidecar => ({
  v: 2,
  f: 'out.ts',
  src: 'openapi.json',
  parser: 'tsc@5.6.3',
  R: [{ host: 'jsr.io', type: 'jsr' }],
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
      generationMap: [],
      outDir
    })

    assertEquals(result.written.length, 3) // 2 sidecars + 1 generationMap
    const aText = await Deno.readTextFile(join(outDir, 'src/types/A.generated.ts.skm.json'))
    const a: Sidecar = JSON.parse(aText)
    assertEquals(a.f, 'src/types/A.generated.ts')
    assertEquals(a.L, ['A'])
  })
})

Deno.test('writeSidecars - writes the generation map NDJSON alongside sidecars', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    const generationMap: GenerationMapEntry[] = [
      { f: 'a.ts', name: 'A', g: 'gen-x', s: 'oas:#/components/schemas/A', v: 'main' }
    ]
    await writeSidecars({
      sidecars: { 'a.ts': baseSidecar({ f: 'a.ts' }) },
      generationMap,
      outDir
    })

    const mapText = await Deno.readTextFile(join(outDir, '_map.ndjson'))
    const parsed = parseNdjson(mapText)
    assertEquals(parsed, generationMap)
  })
})

Deno.test('writeSidecars - empty generation map still writes the file', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    await writeSidecars({
      sidecars: {},
      generationMap: [],
      outDir
    })

    const exists = await Deno.lstat(join(outDir, '_map.ndjson')).then(() => true).catch(() => false)
    assert(exists, 'expected _map.ndjson to exist even when empty')
  })
})

Deno.test('writeSidecars - wholly rewrites the outDir (stale files removed)', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    // First run: write a stale sidecar.
    await writeSidecars({
      sidecars: { 'stale.ts': baseSidecar({ f: 'stale.ts' }) },
      generationMap: [],
      outDir
    })
    const staleExisted = await Deno.lstat(join(outDir, 'stale.ts.skm.json'))
      .then(() => true)
      .catch(() => false)
    assert(staleExisted)

    // Second run: a different sidecar. The stale one must be gone.
    await writeSidecars({
      sidecars: { 'fresh.ts': baseSidecar({ f: 'fresh.ts' }) },
      generationMap: [],
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
      generationMap: [],
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
      generationMap: [],
      outDir
    })

    const text = await Deno.readTextFile(join(outDir, 'a/b/c/d.ts.skm.json'))
    const parsed: Sidecar = JSON.parse(text)
    assertEquals(parsed.f, 'a/b/c/d.ts')
  })
})

Deno.test('writeSidecars - returns total bytes including generation map', async () => {
  await withTempDir(async (tmp) => {
    const outDir = join(tmp, '.maps')
    const result = await writeSidecars({
      sidecars: { 'a.ts': baseSidecar({ f: 'a.ts' }) },
      generationMap: [
        { f: 'a.ts', name: 'X', g: 'gen', s: 'oas:#/components/schemas/X', v: 'main' }
      ],
      outDir
    })

    // totalBytes is non-zero and matches actual bytes on disk.
    const sidecarBytes = (await Deno.readTextFile(join(outDir, 'a.ts.skm.json'))).length
    const mapBytes = (await Deno.readTextFile(join(outDir, '_map.ndjson'))).length
    assertEquals(result.totalBytes, sidecarBytes + mapBytes)
  })
})
