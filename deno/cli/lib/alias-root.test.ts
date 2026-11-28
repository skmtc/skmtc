import { assertEquals } from '@std/assert/equals'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { type AliasSearch, findAliasRoot, isAliasRoot, toFolder } from '@/lib/alias-root.ts'

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

/** The search from `appDir` of the temporary folder: `.` is the folder itself. */
const find = (files: Files, appDir = '.') =>
  withAppRoot(files, tempPath => findAliasRoot({ appRootPath: join(tempPath, appDir) }))

const found = (path: string, from: string): AliasSearch => ({
  type: 'found',
  aliasRoot: { path, from }
})

Deno.test('alias root - reads compilerOptions.paths of tsconfig.json', async () => {
  const tsconfig = JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), found('src', 'tsconfig.json'))
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

  assertEquals(await find({ 'tsconfig.json': tsconfig }), found('app/src', 'tsconfig.json'))
})

Deno.test('alias root - paths are read from baseUrl', async () => {
  const tsconfig = JSON.stringify({
    compilerOptions: { baseUrl: './src', paths: { '@/*': ['./*'] } }
  })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), found('src', 'tsconfig.json'))
})

// The trap: a Vite app has a tsconfig.json with only `references`. Stopping
// at the first file that exists would report "not found" for every Vite app.
Deno.test('alias root - goes on to tsconfig.app.json when tsconfig.json has no alias', async () => {
  const files = {
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }),
    'tsconfig.app.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
  }

  assertEquals(await find(files), found('src', 'tsconfig.app.json'))
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

  assertEquals(await find(files), found('src', 'tsconfig.json'))
})

Deno.test('alias root - an extended config with no baseUrl leaves paths at the config folder', async () => {
  const files = {
    'tsconfig.json': JSON.stringify({
      extends: 'astro/tsconfigs/strict',
      compilerOptions: { paths: { '@/*': ['./src/*'] } }
    }),
    'node_modules/astro/tsconfigs/strict.json': JSON.stringify({ compilerOptions: { strict: true } })
  }

  assertEquals(await find(files), found('src', 'tsconfig.json'))
})

// The trap: a package that is not installed may set a `baseUrl`. A folder
// read without it would be a guess, and `init` would write the guess.
Deno.test('alias root - unreadable, naming the config, when an extended config cannot be read', async () => {
  const tsconfig = JSON.stringify({
    extends: '@acme/tsconfig',
    compilerOptions: { paths: { '@/*': ['./src/*'] } }
  })

  assertEquals(await find({ 'tsconfig.json': tsconfig }), {
    type: 'unreadable',
    extended: '@acme/tsconfig',
    from: 'tsconfig.json'
  })
})

Deno.test('alias root - a config that extends itself is unreadable, with no endless read', async () => {
  const tsconfig = JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { paths: { '@/*': ['./src/*'] } }
  })

  assertEquals((await find({ 'tsconfig.json': tsconfig })).type, 'unreadable')
})

// The trap: a monorepo hoists packages to the `node_modules` of the
// workspace root, above the app. Looked up only beside the app, every
// such `extends` read as unreadable.
Deno.test('alias root - a package that extends names is found in a node_modules above the app', async () => {
  const files = {
    'app/tsconfig.json': JSON.stringify({
      extends: '@acme/tsconfig',
      compilerOptions: { paths: { '@/*': ['./*'] } }
    }),
    'node_modules/@acme/tsconfig/tsconfig.json': JSON.stringify({
      compilerOptions: { baseUrl: '../../../app/src' }
    })
  }

  assertEquals(await find(files, 'app'), found('src', 'tsconfig.json'))
})

Deno.test('alias root - a package config is read from its tsconfig field and its exports', async () => {
  const appTsconfig = (name: string) =>
    JSON.stringify({ extends: name, compilerOptions: { paths: { '@/*': ['./*'] } } })

  assertEquals(
    await find({
      'tsconfig.json': appTsconfig('base'),
      'node_modules/base/package.json': JSON.stringify({ tsconfig: './config/base.json' }),
      'node_modules/base/config/base.json': JSON.stringify({ compilerOptions: { baseUrl: '../../../src' } })
    }),
    found('src', 'tsconfig.json')
  )
  assertEquals(
    await find({
      'tsconfig.json': appTsconfig('kit/tsconfigs/strict'),
      'node_modules/kit/package.json': JSON.stringify({
        exports: { '.': './index.js', './tsconfigs/*': './dist/tsconfigs/*.json' }
      }),
      'node_modules/kit/dist/tsconfigs/strict.json': JSON.stringify({ compilerOptions: { baseUrl: '../../../../src' } })
    }),
    found('src', 'tsconfig.json')
  )
  assertEquals(
    await find({
      'tsconfig.json': appTsconfig('plain'),
      'node_modules/plain/package.json': JSON.stringify({ exports: { types: './a.json', default: './b.json' } }),
      'node_modules/plain/a.json': JSON.stringify({ compilerOptions: { baseUrl: '../../src' } })
    }),
    found('src', 'tsconfig.json')
  )
})

// The trap: `join(dir, '/abs')` is `dir/abs`. An absolute baseUrl or target
// is that folder, and `${configDir}` is the folder of the app's tsconfig.
Deno.test('alias root - an absolute baseUrl, an absolute target and ${configDir} resolve as TypeScript does', async () => {
  const fromAbsoluteBaseUrl = await withAppRoot({}, appRootPath => {
    Deno.writeTextFileSync(
      join(appRootPath, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: join(appRootPath, 'src'), paths: { '@/*': ['./*'] } } })
    )
    return findAliasRoot({ appRootPath })
  })
  const fromAbsoluteTarget = await withAppRoot({}, appRootPath => {
    Deno.writeTextFileSync(
      join(appRootPath, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': [`${join(appRootPath, 'app', 'src')}/*`] } } })
    )
    return findAliasRoot({ appRootPath })
  })
  const fromConfigDir = await find({
    'tsconfig.json': JSON.stringify({ extends: './config/base.json' }),
    'tsconfig.app.json': JSON.stringify({
      extends: './config/base.json',
      compilerOptions: { paths: { '@/*': ['${configDir}/web/*'] } }
    }),
    'config/base.json': JSON.stringify({ compilerOptions: { baseUrl: '${configDir}/ignored' } })
  })

  assertEquals(fromAbsoluteBaseUrl, found('src', 'tsconfig.json'))
  assertEquals(fromAbsoluteTarget, found('app/src', 'tsconfig.json'))
  assertEquals(fromConfigDir, found('web', 'tsconfig.app.json'))
})

// The trap: core's settings schema rejects a basePath with a `..` segment,
// so `init` writing this folder left a config that every later command
// read as none.
Deno.test('alias root - an alias to a folder outside the app root is outside, not found', async () => {
  const outsideByPaths = JSON.stringify({ compilerOptions: { paths: { '@/*': ['../shared/src/*'] } } })
  const outsideByBaseUrl = JSON.stringify({ compilerOptions: { baseUrl: '..', paths: { '@/*': ['./src/*'] } } })
  const absoluteOutside = await withAppRoot({}, appRootPath => {
    Deno.writeTextFileSync(
      join(appRootPath, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': [`${dirname(appRootPath)}/shared/*`] } } })
    )
    return findAliasRoot({ appRootPath })
  })

  assertEquals(await find({ 'tsconfig.json': outsideByPaths }), {
    type: 'outside',
    target: '../shared/src',
    from: 'tsconfig.json'
  })
  assertEquals(await find({ 'tsconfig.json': outsideByBaseUrl }), {
    type: 'outside',
    target: '../src',
    from: 'tsconfig.json'
  })
  assertEquals(await find({ 'deno.json': JSON.stringify({ imports: { '@/': '../lib/' } }) }), {
    type: 'outside',
    target: '../lib',
    from: 'deno.json'
  })
  assertEquals(absoluteOutside, { type: 'outside', target: '../shared', from: 'tsconfig.json' })
})

Deno.test('alias root - reads the import map of deno.json, and the root as "."', async () => {
  assertEquals(
    await find({ 'deno.json': JSON.stringify({ imports: { '@/': './' } }) }),
    found('.', 'deno.json')
  )
  assertEquals(
    await find({ 'deno.json': JSON.stringify({ imports: { '@/': './src/' } }) }),
    found('src', 'deno.json')
  )
})

Deno.test('alias root - not found: no file, a file that does not parse, an alias to a package', async () => {
  assertEquals(await find({}), { type: 'none' })
  assertEquals(await find({ 'tsconfig.json': '{ not json' }), { type: 'none' })
  assertEquals(
    await find({ 'deno.json': JSON.stringify({ imports: { '@/': 'jsr:@scope/pkg/' } }) }),
    { type: 'none' }
  )
  assertEquals(
    await find({ 'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '~/*': ['./src/*'] } } }) }),
    { type: 'none' }
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
