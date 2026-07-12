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

// A host-side-upgraded sidecar (real landmarks + AST paths) whose on-disk
// file was reformatted after generate: `fmtFormatted` is what a formatter
// made of the raw render, so its length drifts from the manifest and every
// raw span is unusable — entries must be re-anchored, not dropped.
// Path '0.1': ExportNamedDeclaration → [TSTypeAliasDeclaration] → index 0,
// whose children are [Identifier, TSTypeLiteral] → index 1.
const fmtFormatted = 'export type Pet = {\n  name: string;\n};\n'
const fmtStatement = 'export type Pet = {\n  name: string;\n};'
const fmtTypeLiteral = '{\n  name: string;\n}'
const fmtSidecar = {
  ...petSidecar,
  f: '@/models/fmt.generated.ts',
  parser: 'oxc@0.41.0',
  L: ['Pet', 'RenamedAway'],
  P: ['', '0.1'],
  A: [
    [0, 0, 1, 1, 0, 0, 34],
    [0, 1, 0, 0, 0, 18, 34],
    [1, 0, 1, 1, 0, 0, 34]
  ],
  An: [0, 1, 0]
}

// Same drifted file but stamped by a DIFFERENT parser version: recorded
// paths must not be trusted (AST key order can differ), so resolution
// falls back to landmark-only spans.
const skewSidecar = {
  ...fmtSidecar,
  f: '@/models/skew.generated.ts',
  parser: 'oxc@9.9.9',
  A: [[0, 1, 0, 0, 0, 18, 34]],
  An: [1]
}

// Length-drifted file containing non-ASCII text: UTF-16 sidecar spans can't
// be aligned with oxc's UTF-8 offsets, so re-anchoring must refuse and the
// file stays stale.
const unicodeSource = "export const label = 'héllo world'\n"
const unicodeSidecar = {
  ...petSidecar,
  f: '@/models/unicode.generated.ts',
  L: ['label'],
  A: [[0, 0, 1, 1, 0, 0, 35]],
  An: [0]
}

// Truncated + non-numeric rows between two good ones: both bad rows must be
// dropped WITHOUT shifting the later good row's `An` producer pairing.
const rowsSource = 'export type Rows = { a: string }\n'
const rowsSidecar = {
  ...petSidecar,
  f: '@/models/rows.generated.ts',
  A: [
    [0, 0, 1, 1, 0, 0, 32],
    [0, 0, 1],
    [0, 0, 1, 1, 0, 'x', 32],
    [0, 0, 0, 0, 0, 21, 27]
  ],
  An: [0, 1, 1, 1]
}

// A duplicate sidecar declaring the same `f` as petSidecar from a stale,
// non-mirror path — the mirror-path copy must win.
const petImpostorSidecar = {
  ...petSidecar,
  A: [[0, 0, 1, 1, 0, 5, 9]],
  An: [1]
}

const manifest = {
  files: {
    'src/models/pet.generated.ts': { lines: 1, characters: petSource.length },
    'src/models/bar.generated.ts': { lines: 1, characters: 10 },
    'src/models/rows.generated.ts': { lines: 1, characters: rowsSource.length },
    // Raw-render lengths; the on-disk copies are longer (formatter ran).
    'src/models/fmt.generated.ts': { lines: 1, characters: petSource.length },
    'src/models/skew.generated.ts': { lines: 1, characters: petSource.length },
    'src/models/unicode.generated.ts': { lines: 1, characters: 20 }
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
    await writeFile(join(maps, 'rows.generated.ts.skm.json'), JSON.stringify(rowsSidecar))
    await writeFile(join(maps, 'broken.generated.ts.skm.json'), '{not json')
    await writeFile(join(maps, 'fmt.generated.ts.skm.json'), JSON.stringify(fmtSidecar))
    await writeFile(join(maps, 'skew.generated.ts.skm.json'), JSON.stringify(skewSidecar))
    await writeFile(join(maps, 'unicode.generated.ts.skm.json'), JSON.stringify(unicodeSidecar))
    // A stale duplicate for pet at a NON-mirror path (sorts before the mirror
    // copy lexicographically — '_' < 'p' — so mirror preference, not order,
    // must decide the winner).
    await writeFile(join(maps, '_stale-pet.skm.json'), JSON.stringify(petImpostorSidecar))
    await mkdir(join(root, 'src', 'models'), { recursive: true })
    await writeFile(join(root, 'src', 'models', 'pet.generated.ts'), petSource)
    await writeFile(join(root, 'src', 'models', 'rows.generated.ts'), rowsSource)
    // bar on disk is LONGER than the manifest render — a formatter ran.
    await writeFile(join(root, 'src', 'models', 'bar.generated.ts'), 'x'.repeat(24))
    await writeFile(join(root, 'src', 'models', 'fmt.generated.ts'), fmtFormatted)
    await writeFile(join(root, 'src', 'models', 'skew.generated.ts'), fmtFormatted)
    await writeFile(join(root, 'src', 'models', 'unicode.generated.ts'), unicodeSource)
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('decodes anchor rows into entries with realigned paths', async () => {
    const { entries } = await readGenMap(root, project, 'src')
    const petEntries = entries.filter(entry => entry.artifactPath === 'src/models/pet.generated.ts')
    expect(petEntries).toEqual([
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

  it('reports a drifted file with no resolvable landmarks as stale, entries excluded', async () => {
    // bar's on-disk content has no matching landmark, so re-anchoring
    // fails wholesale and the pre-re-anchor behavior is preserved.
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    expect(staleFiles).toContain('src/models/bar.generated.ts')
    expect(entries.some(entry => entry.artifactPath.includes('bar'))).toBe(false)
  })

  it('re-anchors a formatted (length-drifted) file instead of dropping it', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    expect(staleFiles).not.toContain('src/models/fmt.generated.ts')
    const fmtEntries = entries.filter(entry => entry.artifactPath === 'src/models/fmt.generated.ts')
    // The landmark-renamed-away anchor is dropped individually; the other
    // two resolve. Empty path → the landmark statement itself; path '0.1'
    // → the type literal, both located in the FORMATTED text.
    expect(fmtEntries).toHaveLength(2)
    const [statementEntry, literalEntry] = fmtEntries
    const sliceOf = (span: [number, number]): string => fmtFormatted.slice(span[0], span[1])
    expect(sliceOf(statementEntry.artifactSpan)).toBe(fmtStatement)
    expect(sliceOf(literalEntry.artifactSpan)).toBe(fmtTypeLiteral)
    expect(literalEntry.producerName).toBe('CustomValue')
  })

  it('falls back to landmark-only spans on a parser-version mismatch', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    expect(staleFiles).not.toContain('src/models/skew.generated.ts')
    const skewEntries = entries.filter(
      entry => entry.artifactPath === 'src/models/skew.generated.ts'
    )
    // The recorded path pointed at the type literal, but the sidecar was
    // stamped by a different parser — the entry resolves to the whole
    // landmark statement instead of descending an untrusted path.
    expect(skewEntries).toHaveLength(1)
    expect(fmtFormatted.slice(skewEntries[0].artifactSpan[0], skewEntries[0].artifactSpan[1])).toBe(
      fmtStatement
    )
  })

  it('keeps a drifted non-ASCII file stale (span-unit skew)', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    expect(staleFiles).toContain('src/models/unicode.generated.ts')
    expect(entries.some(entry => entry.artifactPath.includes('unicode'))).toBe(false)
  })

  it('drops malformed anchor rows without shifting producer attribution', async () => {
    const { entries } = await readGenMap(root, project, 'src')
    const rowsEntries = entries.filter(
      entry => entry.artifactPath === 'src/models/rows.generated.ts'
    )
    // The truncated and non-numeric rows are gone; the surviving second good
    // row still pairs with An[3] → N[1] ('CustomValue'), not a shifted index.
    expect(rowsEntries).toHaveLength(2)
    expect(rowsEntries[0].producerName).toBe('TsDefinition')
    expect(rowsEntries[1]).toMatchObject({
      artifactSpan: [21, 27],
      producerName: 'CustomValue'
    })
  })

  it('one sidecar wins per artifact, preferring the mirror path', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    const petEntries = entries.filter(entry => entry.artifactPath === 'src/models/pet.generated.ts')
    // The impostor at `_stale-pet.skm.json` sorts FIRST lexicographically, so
    // only mirror preference keeps the canonical two-anchor sidecar's entries
    // (the impostor has one anchor at [5, 9]).
    expect(petEntries).toHaveLength(2)
    expect(petEntries.some(entry => entry.artifactSpan[0] === 5)).toBe(false)
    // And no artifact is reported stale twice.
    expect(new Set(staleFiles).size).toBe(staleFiles.length)
  })

  it('drops sidecars not in the manifest and malformed sidecars', async () => {
    const { entries, staleFiles } = await readGenMap(root, project, 'src')
    const paths = new Set(entries.map(entry => entry.artifactPath))
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
