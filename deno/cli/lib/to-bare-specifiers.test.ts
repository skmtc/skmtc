import { assertEquals } from '@std/assert/equals'
import { toBareSpecifiers, toVersionedSpecifier } from '@/lib/to-bare-specifiers.ts'

const rewrite = async (content: string, imports: Record<string, string> = {}) => {
  const { files, pins } = await toBareSpecifiers({ files: [{ path: '/a.ts', content }], imports })

  return { content: files[0].content, pins }
}

Deno.test('toVersionedSpecifier - parses jsr and npm names, versions and subpaths', () => {
  assertEquals(toVersionedSpecifier('jsr:@skmtc/core@0.29.0'), {
    base: 'jsr:@skmtc/core@0.29.0',
    name: '@skmtc/core',
    subpath: ''
  })
  assertEquals(toVersionedSpecifier('jsr:@std/path@^1.0.8/join'), {
    base: 'jsr:@std/path@^1.0.8',
    name: '@std/path',
    subpath: '/join'
  })
  assertEquals(toVersionedSpecifier('npm:ts-pattern@^5.8.0'), {
    base: 'npm:ts-pattern@^5.8.0',
    name: 'ts-pattern',
    subpath: ''
  })
  assertEquals(toVersionedSpecifier('npm:@babel/helper-validator-identifier@7.22.20'), {
    base: 'npm:@babel/helper-validator-identifier@7.22.20',
    name: '@babel/helper-validator-identifier',
    subpath: ''
  })
  assertEquals(toVersionedSpecifier('npm:preact@10.0.0/hooks'), {
    base: 'npm:preact@10.0.0',
    name: 'preact',
    subpath: '/hooks'
  })
  assertEquals(toVersionedSpecifier('jsr:@skmtc/core'), undefined)
  assertEquals(toVersionedSpecifier('npm:valibot'), undefined)
  assertEquals(toVersionedSpecifier('@skmtc/core'), undefined)
  assertEquals(toVersionedSpecifier('./base.ts'), undefined)
})

Deno.test('toBareSpecifiers - maps baked specifiers back to their imports key', async () => {
  const result = await rewrite(
    [
      `import { List } from 'jsr:@skmtc/lang-typescript@0.12.22'`,
      `import { capitalize } from 'jsr:@skmtc/core@0.29.0'`,
      `import type { OasVoid } from "jsr:@skmtc/core@0.29.0"`,
      `import { match } from 'npm:ts-pattern@^5.8.0'`,
      `import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.22.20'`,
      `import { TanstackQueryBase } from './base.ts'`
    ].join('\n'),
    {
      '@skmtc/lang-typescript': 'jsr:@skmtc/lang-typescript@0.12.22',
      '@skmtc/core': 'jsr:@skmtc/core@0.29.0',
      'ts-pattern': 'npm:ts-pattern@^5.8.0',
      '@babel/helper-validator-identifier': 'npm:@babel/helper-validator-identifier@7.22.20'
    }
  )

  assertEquals(
    result.content,
    [
      `import { List } from '@skmtc/lang-typescript'`,
      `import { capitalize } from '@skmtc/core'`,
      `import type { OasVoid } from "@skmtc/core"`,
      `import { match } from 'ts-pattern'`,
      `import { isIdentifierName } from '@babel/helper-validator-identifier'`,
      `import { TanstackQueryBase } from './base.ts'`
    ].join('\n')
  )
  assertEquals(result.pins, {})
})

Deno.test('toBareSpecifiers - keeps the subpath and an aliased key', async () => {
  const result = await rewrite(
    [
      `import { toModuleName } from 'jsr:@skmtc/core@0.29.0/parseModuleName'`,
      `import { useState } from 'npm:preact@10.0.0/hooks'`
    ].join('\n'),
    { core: 'jsr:@skmtc/core@0.29.0', preact: 'npm:preact@10.0.0' }
  )

  assertEquals(
    result.content,
    [
      `import { toModuleName } from 'core/parseModuleName'`,
      `import { useState } from 'preact/hooks'`
    ].join('\n')
  )
})

Deno.test('toBareSpecifiers - pins a package the imports do not name', async () => {
  const result = await rewrite(
    [
      `import { assertEquals } from 'jsr:@std/assert@^1.0.0'`,
      `import { join } from 'jsr:@std/path@1.0.8/join'`,
      `import invariant from 'npm:tiny-invariant@^1.3.3'`,
      `import { h } from 'npm:preact@10.0.0/hooks'`
    ].join('\n')
  )

  assertEquals(
    result.content,
    [
      `import { assertEquals } from '@std/assert'`,
      `import { join } from '@std/path/join'`,
      `import invariant from 'tiny-invariant'`,
      `import { h } from 'preact/hooks'`
    ].join('\n')
  )
  assertEquals(result.pins, {
    '@std/assert': 'jsr:@std/assert@^1.0.0',
    '@std/path': 'jsr:@std/path@1.0.8',
    'tiny-invariant': 'npm:tiny-invariant@^1.3.3',
    preact: 'npm:preact@10.0.0'
  })
})

Deno.test('toBareSpecifiers - leaves imports at conflicting versions versioned', async () => {
  const { files, pins } = await toBareSpecifiers({
    files: [
      { path: '/a.ts', content: `import { join } from 'jsr:@std/path@^1.0.8/join'` },
      { path: '/b.ts', content: `import { join } from 'jsr:@std/path@0.225.0/join'` },
      { path: '/c.ts', content: `import { capitalize } from 'jsr:@skmtc/core@0.28.0'` }
    ],
    imports: { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' }
  })

  assertEquals(
    files.map(({ content }) => content),
    [
      `import { join } from 'jsr:@std/path@^1.0.8/join'`,
      `import { join } from 'jsr:@std/path@0.225.0/join'`,
      `import { capitalize } from 'jsr:@skmtc/core@0.28.0'`
    ]
  )
  assertEquals(pins, {})
})

Deno.test('toBareSpecifiers - rewrites every import position deno_graph reports', async () => {
  const result = await rewrite(
    [
      `import {`,
      `  a,`,
      `  b`,
      `} from 'jsr:@skmtc/core@0.29.0'`,
      `export * from 'jsr:@skmtc/gen-zod@0.2.7'`,
      `import 'jsr:@skmtc/side-effect@1.0.0'`,
      `const lazy = await import('jsr:@skmtc/lazy@2.0.0-rc.1/sub/path')`,
      'const template = await import(`jsr:@skmtc/template@1.0.0`)',
      `declare module 'jsr:@skmtc/ambient@1.0.0' {}`,
      `// @ts-types="npm:@types/foo@1.0.0"`,
      `import foo from 'npm:foo@1.2.3'`
    ].join('\n')
  )

  assertEquals(
    result.content,
    [
      `import {`,
      `  a,`,
      `  b`,
      `} from '@skmtc/core'`,
      `export * from '@skmtc/gen-zod'`,
      `import '@skmtc/side-effect'`,
      `const lazy = await import('@skmtc/lazy/sub/path')`,
      'const template = await import(`@skmtc/template`)',
      `declare module '@skmtc/ambient' {}`,
      `// @ts-types="@types/foo"`,
      `import foo from 'foo'`
    ].join('\n')
  )
  assertEquals(Object.keys(result.pins).sort(), [
    '@skmtc/ambient',
    '@skmtc/core',
    '@skmtc/gen-zod',
    '@skmtc/lazy',
    '@skmtc/side-effect',
    '@skmtc/template',
    '@types/foo',
    'foo'
  ])
})

Deno.test('toBareSpecifiers - leaves strings, comments and runtime resolution alone', async () => {
  const content = [
    `// import { a } from 'jsr:@skmtc/core@0.29.0'`,
    `/** @example import { b } from 'jsr:@skmtc/core@0.29.0' */`,
    "const emitted = `import { Hono } from 'jsr:@hono/hono@4.6.0'`",
    `const pin = 'jsr:@skmtc/core@0.29.0'`,
    `const url = import.meta.resolve('jsr:@std/path@1.0.8/join')`
  ].join('\n')

  const result = await rewrite(content)

  assertEquals(result.content, content)
  assertEquals(result.pins, {})
})

Deno.test('toBareSpecifiers - counts columns in code points and keeps CRLF', async () => {
  const result = await rewrite(
    `/* é😀 */ import x from 'jsr:@skmtc/core@0.29.0'\r\nimport y from 'jsr:@skmtc/core@0.29.0'\r\n`,
    { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' }
  )

  assertEquals(
    result.content,
    `/* é😀 */ import x from '@skmtc/core'\r\nimport y from '@skmtc/core'\r\n`
  )
})

Deno.test('toBareSpecifiers - leaves a file that does not parse as served', async () => {
  const content = `import { a } from 'jsr:@skmtc/core@0.29.0'\nconst = {`

  const result = await rewrite(content, { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' })

  assertEquals(result.content, content)
})

Deno.test('toBareSpecifiers - rewrites every import of a repeated specifier', async () => {
  const result = await rewrite(
    [
      `import { a } from 'jsr:@skmtc/core@0.29.0'`,
      `import type { B } from 'jsr:@skmtc/core@0.29.0'`,
      `export { c } from 'jsr:@skmtc/core@0.29.0'`,
      `import type { D } from 'jsr:@skmtc/core@0.29.0'`,
      `const e = await import('jsr:@skmtc/core@0.29.0')`
    ].join('\n'),
    { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' }
  )

  assertEquals(
    result.content,
    [
      `import { a } from '@skmtc/core'`,
      `import type { B } from '@skmtc/core'`,
      `export { c } from '@skmtc/core'`,
      `import type { D } from '@skmtc/core'`,
      `const e = await import('@skmtc/core')`
    ].join('\n')
  )
})
