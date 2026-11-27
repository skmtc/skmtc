import { assertEquals } from '@std/assert/equals'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { findAliasRoot, isAliasRoot, toFolder } from '@/lib/alias-root.ts'

type Files = Record<string, string>

const withAppRoot = async <T>(files: Files, fn: (appRootPath: string) => T): Promise<T> => {
  const appRootPath = await Deno.makeTempDir({ prefix: 'skmtc-alias-root-' })

  try {
    for (const [name, text] of Object.entries(files)) {
      await Deno.mkdir(dirname(join(appRootPath, name)), { recursive: true })
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

// The trap: `paths` resolve from `baseUrl`, and a base config can set it.
// Read as if it were `.`, `./*` gives the app root where TypeScript gives `src`.
Deno.test('alias root - a baseUrl of an extended config applies to paths', async () => {
  const files = {
    'tsconfig.json': JSON.stringify({
      extends: './config/tsconfig.base.json',
      compilerOptions: { paths: { '@/*': ['./*'] } }
    }),
    'config/tsconfig.base.json': JSON.stringify({ compilerOptions: { baseUrl: '../src' } })
  }

  assertEquals(await find(files), { path: 'src', from: 'tsconfig.json' })
})

Deno.test('alias root - an extended config with no baseUrl leaves paths at the config folder', async () => {
  const files = {
    'tsconfig.json': JSON.stringify({
      extends: 'astro/tsconfigs/strict',
      compilerOptions: { paths: { '@/*': ['./src/*'] } }
    }),
    'node_modules/astro/tsconfigs/strict.json': JSON.stringify({ compilerOptions: { strict: true } })
  }

  assertEquals(await find(files), { path: 'src', from: 'tsconfig.json' })
})

// The trap: a package that is not installed may set a `baseUrl`. A folder
// read without it would be a guess, and `init` would write the guess.
Deno.test('alias root - not found when an extended config cannot be read', async () => {
  const tsconfig = JSON.stringify({
    extends: '@acme/tsconfig',
    compilerOptions: { paths: { '@/*': ['./src/*'] } }
  })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), undefined)
})

Deno.test('alias root - a config that extends itself is not found, with no endless read', async () => {
  const tsconfig = JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { paths: { '@/*': ['./src/*'] } }
  })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), undefined)
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

// The trap: the platform's path functions write `app\src` on Windows, and
// `client.json` holds `app/src`. Compared as text, one folder is two.
Deno.test('alias root - a folder is written with "/" on every platform', () => {
  assertEquals(toFolder('app\\src'), 'app/src')
  assertEquals(toFolder('.\\app\\src\\'), 'app/src')
  assertEquals(isAliasRoot('app\\src', { path: 'app/src', from: 'tsconfig.json' }), true)
})
