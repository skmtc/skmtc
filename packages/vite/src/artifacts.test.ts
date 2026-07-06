import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readArtifactContent, readArtifacts } from './artifacts.ts'

const manifest = {
  files: {
    'src/forms/CreateFoo.tsx': { lines: 12, characters: 340 },
    'src/models/bar.ts': { lines: 3, characters: 80 }
  }
}

describe('artifacts', () => {
  const project = 'demo'
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'skmtc-artifacts-'))
    const settings = join(root, '.skmtc', project, '.settings')
    await mkdir(settings, { recursive: true })
    await writeFile(join(settings, 'manifest.json'), JSON.stringify(manifest))
    await mkdir(join(root, 'src', 'forms'), { recursive: true })
    await writeFile(join(root, 'src', 'forms', 'CreateFoo.tsx'), 'export const CreateFoo = 1\n')
    await writeFile(join(root, 'secret.txt'), 'nope')
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists the manifest files, sorted', async () => {
    expect(await readArtifacts(root, project)).toEqual([
      { path: 'src/forms/CreateFoo.tsx', lines: 12, characters: 340 },
      { path: 'src/models/bar.ts', lines: 3, characters: 80 }
    ])
  })

  it('returns [] when there is no manifest', async () => {
    expect(await readArtifacts(root, 'other')).toEqual([])
  })

  it('reads the contents of a manifest-listed file', async () => {
    expect(await readArtifactContent(root, project, 'src/forms/CreateFoo.tsx')).toBe(
      'export const CreateFoo = 1\n'
    )
  })

  it('refuses a path not in the manifest (the traversal guard)', async () => {
    expect(await readArtifactContent(root, project, 'secret.txt')).toBeNull()
    expect(await readArtifactContent(root, project, '../outside.ts')).toBeNull()
  })

  it('returns null for a manifest-listed file missing on disk', async () => {
    expect(await readArtifactContent(root, project, 'src/models/bar.ts')).toBeNull()
  })
})
