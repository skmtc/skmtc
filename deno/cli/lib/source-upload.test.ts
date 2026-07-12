import { assertEquals } from '@std/assert/equals'
import { join } from 'jsr:@std/path@^1'
import { collectBaseFiles, collectSourceFiles } from './source-upload.ts'

/** Write a file at `root/rel`, creating parent dirs. */
const write = async (root: string, rel: string, content = '') => {
  const abs = join(root, rel)
  await Deno.mkdir(join(abs, '..'), { recursive: true })
  await Deno.writeTextFile(abs, content)
}

Deno.test('collectSourceFiles - keeps authored source, drops derived/secret/binary/dep', async () => {
  const root = await Deno.makeTempDir()
  try {
    // kept — authored source + config, including non-junk dotfiles
    await write(root, 'deno.json', '{}')
    await write(root, 'keep.txt')
    await write(root, '.gitignore') // dotfile, but not known-junk → uploaded
    await write(root, '.settings/client.json', '{}')
    await write(root, 'gen-foo/mod.ts')
    await write(root, 'reapit-refs/mod.ts')

    // dropped — derived root artefacts
    await write(root, 'worker.ts')
    await write(root, 'server.ts')
    await write(root, 'server.js')
    await write(root, 'bundle.js')
    // dropped — secrets / OS cruft
    await write(root, '.env', 'SECRET=1')
    await write(root, '.DS_Store')
    // dropped — binary asset
    await write(root, 'gen-foo/logo.png')
    // dropped — dependency dir (pruned)
    await write(root, 'node_modules/dep/index.js')

    const files = await collectSourceFiles(root)
    assertEquals(
      files.map(file => file.path),
      [
        '.gitignore',
        '.settings/client.json',
        'deno.json',
        'gen-foo/mod.ts',
        'keep.txt',
        'reapit-refs/mod.ts'
      ]
    )
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})

Deno.test('collectSourceFiles - .skmtcignore adds exclusions (files + dirs)', async () => {
  const root = await Deno.makeTempDir()
  try {
    await write(root, 'deno.json', '{}')
    await write(root, 'keep.txt')
    await write(root, 'scratch.txt')
    await write(root, 'secrets/key.txt')
    await write(root, '.skmtcignore', 'scratch.txt\nsecrets/\n')

    const files = await collectSourceFiles(root)
    assertEquals(
      files.map(file => file.path),
      ['.skmtcignore', 'deno.json', 'keep.txt']
    )
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})

Deno.test('collectSourceFiles - .skmtcignore can re-include a default-excluded path', async () => {
  const root = await Deno.makeTempDir()
  try {
    await write(root, 'deno.json', '{}')
    await write(root, 'diagram.png') // default-excluded binary
    await write(root, '.skmtcignore', '!diagram.png\n')

    const files = await collectSourceFiles(root)
    assertEquals(
      files.map(file => file.path),
      ['.skmtcignore', 'deno.json', 'diagram.png']
    )
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})

Deno.test('collectBaseFiles - keeps hand-written; drops .skmtc/, deps, generated, ignored', async () => {
  const root = await Deno.makeTempDir()
  try {
    await write(root, 'package.json', '{}')
    await write(root, 'src/app.tsx', 'export const App = () => null')
    await write(root, 'src/types/User.generated.ts', '// generated')
    await write(root, '.skmtc/proj/mod.ts', '// stack workspace')
    await write(root, 'node_modules/dep/index.js', '// dep')
    await write(root, 'dist/out.js', '// build output')
    await write(root, '.skmtcignore', 'dist/\n/.skmtcignore\n')

    const files = await collectBaseFiles(root, new Set(['src/types/User.generated.ts']))

    assertEquals(Object.keys(files).sort(), ['package.json', 'src/app.tsx'])
    assertEquals(files['package.json'], '{}')
  } finally {
    await Deno.remove(root, { recursive: true })
  }
})
