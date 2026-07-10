import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readGenMap } from './gen-map.ts'

// A minimal v2 sidecar: pools + anchor rows `[Li, Pi, gi, si, vi, from, to]`.
// Two anchors — an attributed outer definition and an unattributed inner
// snippet (`<unknown>` generator, empty pointer), mirroring real output.
const petSource = 'export type Pet = { name: string }\n'
const petSidecar = {
  v: 2,
  f: '@/models/pet.generated.ts',
  G: [
    { name: '<unknown>', version: '', r: 0 },
    { name: '@acme/gen-typescript', version: '', r: 0 }
  ],
  S: ['', '#/components/schemas/Pet'],
  V: ['main'],
  L: ['Pet'],
  P: [''],
  A: [
    [0, 0, 1, 1, 0, 0, 34],
    [0, 0, 0, 0, 0, 18, 34]
  ],
  N: ['TsDefinition', 'CustomValue'],
  An: [0, 1]
}

// Same shape for a file that will be made stale (formatted after generate).
const barSidecar = {
  ...petSidecar,
  f: '@/models/bar.generated.ts',
  A: [[0, 0, 1, 1, 0, 0, 10]],
  An: [0]
}

// A sidecar for an artifact no longer in the manifest (a removed file whose
// sidecar lingers in `.maps`).
const goneSidecar = { ...petSidecar, f: '@/models/gone.generated.ts' }

const manifest = {
  files: {
    'src/models/pet.generated.ts': { lines: 1, characters: petSource.length },
    'src/models/bar.generated.ts': { lines: 1, characters: 10 }
  }
}

describe('readGenMap', () => {
  const project = 'demo'
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'skmtc-gen-map-'))
    const projectDir = join(root, '.skmtc', project)
    await mkdir(join(projectDir, '.settings'), { recursive: true })
    await writeFile(join(projectDir, '.settings', 'manifest.json'), JSON.stringify(manifest))
    const maps = join(projectDir, '.maps', '@', 'models')
    await mkdir(maps, { recursive: true })
    await writeFile(join(maps, 'pet.generated.ts.skm.json'), JSON.stringify(petSidecar))
    await writeFile(join(maps, 'bar.generated.ts.skm.json'), JSON.stringify(barSidecar))
    await writeFile(join(maps, 'gone.generated.ts.skm.json'), JSON.stringify(goneSidecar))
    await writeFile(join(maps, 'broken.generated.ts.skm.json'), '{not json')
    await mkdir(join(root, 'src', 'models'), { recursive: true })
    await writeFile(join(root, 'src', 'models', 'pet.generated.ts'), petSource)
    // bar on disk is LONGER than the manifest render — a formatter ran.
    await writeFile(join(root, 'src', 'models', 'bar.generated.ts'), 'x'.repeat(24))
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('decodes anchor rows into entries with realigned paths', async () => {
    const { entries } = await readGenMap(root, project, 'src')
    expect(entries).toEqual([
      {
        artifactPath: 'src/models/pet.generated.ts',
        artifactSpan: [0, 34],
        projectionName: 'Pet',
        producerName: 'TsDefinition',
        generatorRef: '@acme/gen-typescript',
        schemaPointer: '#/components/schemas/Pet',
        variant: 'main'
      },
      {
        artifactPath: 'src/models/pet.generated.ts',
        artifactSpan: [18, 34],
        projectionName: 'Pet',
        producerName: 'CustomValue',
        generatorRef: '<unknown>',
        schemaPointer: '',
        variant: 'main'
      }
    ])
  })

  it('reports a formatted (length-drifted) file as stale, entries excluded', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    expect(staleFiles).toEqual(['src/models/bar.generated.ts'])
    expect(entries.some((entry) => entry.artifactPath.includes('bar'))).toBe(false)
  })

  it('drops sidecars not in the manifest and malformed sidecars', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    const paths = new Set(entries.map((entry) => entry.artifactPath))
    expect(paths.has('src/models/gone.generated.ts')).toBe(false)
    expect(staleFiles.includes('src/models/gone.generated.ts')).toBe(false)
  })

  it('returns empty for a project with no .maps tree', async () => {
    expect(await readGenMap(root, 'other', 'src')).toEqual({ entries: [], staleFiles: [] })
  })

  it("strips the alias without a prefix for the engine's root-relative fallback", async () => {
    // basePath absent → the engine writes relative to the project root ('.')
    // and manifest keys carry no prefix; nothing here matches the src/-keyed
    // manifest, so entries drop out via the membership guard rather than
    // being mis-prefixed.
    const { entries } = await readGenMap(root, project, '.')
    expect(entries).toEqual([])
  })
})
