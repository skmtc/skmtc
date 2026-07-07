import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { SourceState } from './source-state.ts'

// The §8 regression, exercised end-to-end through a real TypeScript service in
// the layout that broke: a nested monorepo where the skmtc root (holding
// `.skmtc/`) is the repo root, but `typescript`, the app `tsconfig`, the
// `@hookform/lenses` contract dep, and the generated code all live under the
// nested Vite root (`apps/x`). The probe MUST root at the Vite root — rooting it
// at the skmtc root (the pre-fix behavior) can't load `typescript` or resolve
// the lens contract, and every field returns `unavailable`.
describe('SourceState.match in a nested monorepo', () => {
  const project = 'app'
  let skmtcRoot: string
  let viteRoot: string

  const write = async (path: string, content: string): Promise<void> => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }

  beforeAll(async () => {
    skmtcRoot = await mkdtemp(join(tmpdir(), 'skmtc-source-state-'))
    viteRoot = join(skmtcRoot, 'apps', 'x')

    // .skmtc/ lives at the repo root. client.json points basePath + inputDirs at
    // the nested app (repo-root-relative), the way a monorepo project is wired.
    await write(
      join(skmtcRoot, '.skmtc', project, '.settings', 'client.json'),
      JSON.stringify({
        source: 'schema.json',
        settings: { basePath: 'apps/x/src', inputDirs: ['apps/x/src/inputs'] }
      })
    )
    // The gen-map (only emitted by `generate --anchors`) resolves the model name.
    await write(
      join(skmtcRoot, '.skmtc', project, '.maps', '_map.ndjson'),
      JSON.stringify({ name: 'CreateThingModel', f: '@/types/CreateThingModel' }) + '\n'
    )
    // Minimal schema: the matcher only reads the model NAME off the operation.
    await write(
      join(skmtcRoot, 'schema.json'),
      JSON.stringify({
        paths: {
          '/things': {
            post: {
              requestBody: {
                content: {
                  'application/json': { schema: { $ref: '#/components/schemas/CreateThingModel' } }
                }
              }
            }
          }
        },
        components: { schemas: { CreateThingModel: { type: 'object' } } }
      })
    )

    // The nested Vite app: typescript + the lens contract are APP deps (not at
    // the repo root), the app owns the tsconfig, and the generated code lives
    // here. `typescript` is symlinked from this package's own install.
    const tsPackageDir = dirname(
      createRequire(import.meta.url).resolve('typescript/package.json')
    )
    await mkdir(join(viteRoot, 'node_modules'), { recursive: true })
    await symlink(tsPackageDir, join(viteRoot, 'node_modules', 'typescript'), 'dir')
    await write(join(viteRoot, 'package.json'), JSON.stringify({ name: 'x' }))
    // A stub for the contract's `@hookform/lenses` import — resolvable ONLY from
    // the Vite root, so the test fails if the probe is rooted anywhere else.
    await write(
      join(viteRoot, 'node_modules', '@hookform', 'lenses', 'package.json'),
      JSON.stringify({ name: '@hookform/lenses', types: 'index.d.ts' })
    )
    await write(
      join(viteRoot, 'node_modules', '@hookform', 'lenses', 'index.d.ts'),
      'export type Lens<T> = { readonly __lens: T }\n'
    )
    await write(
      join(viteRoot, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          moduleResolution: 'bundler',
          module: 'esnext',
          target: 'es2020',
          strict: true,
          jsx: 'preserve',
          baseUrl: '.',
          paths: { '@/*': ['src/*'] }
        }
      })
    )
    // The generated model and two candidate inputs.
    await write(
      join(viteRoot, 'src', 'types', 'CreateThingModel.ts'),
      'export type CreateThingModel = { forename: string; officeIds: string[] }\n'
    )
    await write(
      join(viteRoot, 'src', 'inputs', 'OfficeSelect.tsx'),
      `import type { Lens } from '@hookform/lenses'\nexport const OfficeSelect = (props: { lens: Lens<string[]> }) => props\n`
    )
    await write(
      join(viteRoot, 'src', 'inputs', 'TextInput.tsx'),
      `import type { Lens } from '@hookform/lenses'\nexport const TextInput = (props: { lens: Lens<string> }) => props\n`
    )
  })

  afterAll(async () => {
    await rm(skmtcRoot, { recursive: true, force: true })
  })

  const request = {
    subject: { type: 'operation' as const, path: '/things', method: 'post' },
    schemaPath: ['RequestBody', 'officeIds']
  }

  it('adjudicates the builtin lens contract against a string[] field', async () => {
    const state = new SourceState(skmtcRoot, viteRoot, project)
    const outcome = await state.match(request)
    // The probe loaded the app's TypeScript, resolved @hookform/lenses + the
    // re-based model/candidate imports, and type-checked the field.
    expect(outcome.type).toBe('fits')
    if (outcome.type !== 'fits') return
    expect(outcome.fieldType).toContain('string[]')
    expect(outcome.fits.map((c) => c.exportName)).toEqual(['OfficeSelect'])
    expect(outcome.misfits.map((c) => c.exportName)).toEqual(['TextInput'])
  })

  it('rooting the probe at the skmtc root (the pre-fix bug) makes it unavailable', async () => {
    // Both roots = skmtc root: typescript is not resolvable there, so the
    // service never loads — exactly the failure §8 fixed.
    const state = new SourceState(skmtcRoot, skmtcRoot, project)
    const outcome = await state.match(request)
    expect(outcome.type).toBe('unavailable')
  })
})
