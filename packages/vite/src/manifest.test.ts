import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readPreviews, toModuleUrl } from './manifest.ts'

describe('readPreviews', () => {
  const project = 'demo'
  const basePath = 'src'
  let root: string

  // One preview backed by an emitted file (renderable) and one phantom: a
  // `<Model>SelectField` the generator registered as a subject but never wrote
  // (no entry in `files`). The phantom 404s on import, so it must be dropped.
  const previewManifest = {
    files: {
      'src/inputs/enums/EnquiryTypeMultiSelectField.generated.tsx': { lines: 1 }
    },
    previews: {
      EnquiryTypeMultiSelectField: {
        name: 'EnquiryTypeMultiSelectField',
        module: {
          name: 'EnquiryTypeMultiSelectField',
          exportPath: '@/inputs/enums/EnquiryTypeMultiSelectField.generated.tsx'
        },
        source: { type: 'model', refName: 'EnquiryType' }
      },
      ApplicantContactAddressModelSelectField: {
        name: 'ApplicantContactAddressModelSelectField',
        module: {
          name: 'ApplicantContactAddressModelSelectField',
          exportPath: '@/inputs/enums/ApplicantContactAddressModelSelectField.generated.tsx'
        },
        source: { type: 'model', refName: 'ApplicantContactAddressModel' }
      }
    }
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'skmtc-previews-'))
    const dir = join(root, '.skmtc', project, '.settings')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(previewManifest))
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('drops phantom previews whose module was never written to disk', async () => {
    const previews = await readPreviews(root, project, basePath)
    expect(previews.map((preview) => preview.name)).toEqual(['EnquiryTypeMultiSelectField'])
  })

  it('resolves each preview to a Vite-servable /@fs/ module url', async () => {
    const [preview] = await readPreviews(root, project, basePath)
    expect(preview.module.url).toBe(
      `/@fs${join(root, basePath, 'inputs/enums/EnquiryTypeMultiSelectField.generated.tsx')}`
    )
  })

  it('returns [] when the manifest is missing', async () => {
    expect(await readPreviews(join(root, 'nope'), project, basePath)).toEqual([])
  })
})

describe('readPreviews — monorepo basePath', () => {
  const project = 'lighthouse-ui'
  const basePath = 'apps/lighthouse-ui/src'
  let root: string

  // Monorepo layout: the skmtc project lives at the repo root but the app is
  // nested (`basePath: apps/lighthouse-ui/src`), so `files` keys are full
  // on-disk paths (`apps/…`). The `@/…` `destinationPath` — not the key — is
  // what a preview's `exportPath` matches. Building the emitted set from the
  // raw keys treats every preview as a phantom → 0 previews (the bug).
  const monorepoManifest = {
    files: {
      'apps/lighthouse-ui/src/tables/ContactsTable.generated.tsx': {
        lines: 1,
        destinationPath: '@/tables/ContactsTable.generated.tsx'
      }
    },
    previews: {
      ContactsTable: {
        name: 'ContactsTable',
        module: {
          name: 'ContactsTable',
          exportPath: '@/tables/ContactsTable.generated.tsx'
        },
        source: { type: 'model', refName: 'Contacts' }
      }
    }
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'skmtc-previews-monorepo-'))
    const dir = join(root, '.skmtc', project, '.settings')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(monorepoManifest))
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('keeps previews when files keys are basePath-prefixed but destinationPath is @/-aliased', async () => {
    const previews = await readPreviews(root, project, basePath)
    expect(previews.map((preview) => preview.name)).toEqual(['ContactsTable'])
  })

  // Symptom 2: the module url must be an absolute /@fs/ path (Vite-root-
  // independent), NOT the basePath-rooted `/apps/lighthouse-ui/src/…` that the
  // nested app's Vite can't serve (SPA fallback → text/html → rejected as JS).
  it('resolves the module url via /@fs/ absolute path, not a basePath-rooted url', async () => {
    const [preview] = await readPreviews(root, project, basePath)
    expect(preview.module.url).toBe(
      `/@fs${join(root, basePath, 'tables/ContactsTable.generated.tsx')}`
    )
    // Absolute (/@fs/…), so it survives the Vite-root/skmtc-root split; NOT the
    // bare basePath-rooted `/apps/lighthouse-ui/src/…` the nested app can't serve.
    expect(preview.module.url.startsWith('/@fs/')).toBe(true)
    expect(preview.module.url.startsWith('/apps/')).toBe(false)
  })
})

describe('toModuleUrl', () => {
  it('addresses the file via /@fs/ regardless of basePath depth', () => {
    expect(toModuleUrl('/repo', 'apps/x/src', '@/tables/Foo.generated.tsx')).toBe(
      '/@fs/repo/apps/x/src/tables/Foo.generated.tsx'
    )
    expect(toModuleUrl('/repo', 'src', '@/tables/Foo.generated.tsx')).toBe(
      '/@fs/repo/src/tables/Foo.generated.tsx'
    )
  })

  it('returns a non-alias path unchanged (nothing to resolve)', () => {
    expect(toModuleUrl('/repo', 'src', '/already/absolute.tsx')).toBe('/already/absolute.tsx')
  })
})
