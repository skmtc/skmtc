import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readPreviews } from './manifest.ts'

describe('readPreviews', () => {
  const project = 'demo'
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
    const previews = await readPreviews(root, project)
    expect(previews.map((preview) => preview.name)).toEqual(['EnquiryTypeMultiSelectField'])
  })

  it('returns [] when the manifest is missing', async () => {
    expect(await readPreviews(join(root, 'nope'), project)).toEqual([])
  })
})
