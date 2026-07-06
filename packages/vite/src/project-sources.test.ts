import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readCandidates, readSchema, readSource } from './project-sources.ts'

describe('project-sources', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'skmtc-sources-'))
    await mkdir(join(root, 'src/inputs/nested'), { recursive: true })
    await mkdir(join(root, 'src/inputs/node_modules'), { recursive: true })
    await writeFile(join(root, 'src/inputs/A.tsx'), 'export const A = 1')
    await writeFile(join(root, 'src/inputs/B.ts'), 'export const B = 2')
    await writeFile(join(root, 'src/inputs/README.md'), '# skip me')
    await writeFile(join(root, 'src/inputs/nested/C.tsx'), 'export const C = 3')
    await writeFile(join(root, 'src/inputs/node_modules/dep.ts'), 'export const dep = 4')
    await writeFile(join(root, 'schema.json'), JSON.stringify({ openapi: '3.0.0' }))
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('collects .ts/.tsx (relative paths), skipping node_modules + non-source', async () => {
    const files = await readSource(root, ['src/inputs'])
    expect(files.map((file) => file.path).sort()).toEqual([
      'src/inputs/A.tsx',
      'src/inputs/B.ts',
      'src/inputs/nested/C.tsx'
    ])
    expect(files.find((file) => file.path === 'src/inputs/A.tsx')?.content).toBe(
      'export const A = 1'
    )
  })

  it('skips a missing inputDir without throwing', async () => {
    expect(await readSource(root, ['src/does-not-exist'])).toEqual([])
  })

  it('reads a local schema path relative to root', async () => {
    expect(await readSchema(root, './schema.json')).toEqual({ openapi: '3.0.0' })
  })

  it('parses value exports into candidates with @/ exportPaths + on-disk filePaths', async () => {
    const candidates = await readCandidates(root, ['src/inputs'], 'src')
    expect(candidates).toContainEqual({
      exportName: 'A',
      exportPath: '@/inputs/A.tsx',
      filePath: 'src/inputs/A.tsx'
    })
    expect(candidates).toContainEqual({
      exportName: 'B',
      exportPath: '@/inputs/B.ts',
      filePath: 'src/inputs/B.ts'
    })
    expect(candidates).toContainEqual({
      exportName: 'C',
      exportPath: '@/inputs/nested/C.tsx',
      filePath: 'src/inputs/nested/C.tsx'
    })
  })
})
