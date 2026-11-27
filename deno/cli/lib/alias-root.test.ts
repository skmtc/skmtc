import { assertEquals } from '@std/assert/equals'
import { join } from '@std/path/join'
import { findAliasRoot, isAliasRoot, toFolder } from '@/lib/alias-root.ts'

type Files = Record<string, string>

const withAppRoot = async <T>(files: Files, fn: (appRootPath: string) => T): Promise<T> => {
  const appRootPath = await Deno.makeTempDir({ prefix: 'skmtc-alias-root-' })

  try {
    for (const [name, text] of Object.entries(files)) {
      await Deno.writeTextFile(join(appRootPath, name), text)
    }

    return fn(appRootPath)
  } finally {
    await Deno.remove(appRootPath, { recursive: true })
  }
}

const find = (files: Files) =>
  withAppRoot(files, appRootPath => findAliasRoot({ appRootPath }))

Deno.test('alias root - reads compilerOptions.paths of tsconfig.json', async () => {
  const tsconfig = JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), { path: 'src', from: 'tsconfig.json' })
})

// The trap: a tsconfig is JSON with comments and trailing commas, and
// `JSON.parse` fails on the file that `tsc --init` and Vite write.
Deno.test('alias root - reads a tsconfig with comments and trailing commas', async () => {
  const tsconfig = `{
    // Path mapping
    "compilerOptions": {
      "baseUrl": ".",
      "paths": { "@/*": ["app/src/*"], },
    },
  }`

  assertEquals(await find({ 'tsconfig.json': tsconfig }), {
    path: 'app/src',
    from: 'tsconfig.json'
  })
})

Deno.test('alias root - paths are read from baseUrl', async () => {
  const tsconfig = JSON.stringify({
    compilerOptions: { baseUrl: './src', paths: { '@/*': ['./*'] } }
  })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), { path: 'src', from: 'tsconfig.json' })
})

// The trap: a Vite app has a tsconfig.json with only `references`. Stopping
// at the first file that exists would report "not found" for every Vite app.
Deno.test('alias root - goes on to tsconfig.app.json when tsconfig.json has no alias', async () => {
  const files = {
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }),
    'tsconfig.app.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
  }

  assertEquals(await find(files), { path: 'src', from: 'tsconfig.app.json' })
})

Deno.test('alias root - reads the import map of deno.json, and the root as "."', async () => {
  assertEquals(await find({ 'deno.json': JSON.stringify({ imports: { '@/': './' } }) }), {
    path: '.',
    from: 'deno.json'
  })
  assertEquals(await find({ 'deno.json': JSON.stringify({ imports: { '@/': './src/' } }) }), {
    path: 'src',
    from: 'deno.json'
  })
})

Deno.test('alias root - not found: no file, a file that does not parse, an alias to a package', async () => {
  assertEquals(await find({}), undefined)
  assertEquals(await find({ 'tsconfig.json': '{ not json' }), undefined)
  assertEquals(
    await find({ 'deno.json': JSON.stringify({ imports: { '@/': 'jsr:@scope/pkg/' } }) }),
    undefined
  )
  assertEquals(
    await find({ 'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '~/*': ['./src/*'] } } }) }),
    undefined
  )
})

Deno.test('alias root - a basePath matches with or without "./" and a trailing slash', () => {
  const aliasRoot = { path: 'src', from: 'tsconfig.json' }

  assertEquals(isAliasRoot('src', aliasRoot), true)
  assertEquals(isAliasRoot('./src/', aliasRoot), true)
  assertEquals(isAliasRoot('src/generated', aliasRoot), false)
  assertEquals(toFolder('./'), '.')
})
