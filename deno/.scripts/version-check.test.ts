import { assertEquals, assertThrows } from '@std/assert'
import {
  isShippedChange,
  parseVersionCheckArgs,
  toVersionProblems,
  type VersionCheckPackage
} from './version-check.ts'

const core: VersionCheckPackage = { name: '@skmtc/core', version: '0.32.2', directory: 'core' }
const langGo: VersionCheckPackage = {
  name: '@skmtc/lang-go',
  version: '0.1.0',
  directory: 'lang-go',
  private: true
}

const problemsFor = (
  changedFiles: string[],
  options: { baseVersion?: string; published?: string[]; packages?: VersionCheckPackage[] } = {}
): string[] =>
  toVersionProblems({
    packages: options.packages ?? [core],
    changedFiles,
    baseVersions: new Map(
      options.baseVersion === undefined ? [] : [['@skmtc/core', options.baseVersion]]
    ),
    published: new Set(options.published ?? [])
  })

Deno.test('toVersionProblems - a changed package at the base version fails and names the bump', () => {
  assertEquals(problemsFor(['core/src/parse.ts', 'core/deno.json'], { baseVersion: '0.32.2' }), [
    "@skmtc/core: files changed but version 0.32.2 equals the base's; run `deno task bump core`"
  ])
})

Deno.test('toVersionProblems - a bumped version already on JSR fails', () => {
  assertEquals(
    problemsFor(['core/src/parse.ts'], {
      baseVersion: '0.32.1',
      published: ['@skmtc/core@0.32.1', '@skmtc/core@0.32.2']
    }),
    ['@skmtc/core: version 0.32.2 is already published on JSR; run `deno task bump core`']
  )
})

Deno.test('toVersionProblems - a fresh bump passes', () => {
  assertEquals(
    problemsFor(['core/src/parse.ts', 'core/deno.json'], {
      baseVersion: '0.32.1',
      published: ['@skmtc/core@0.32.1']
    }),
    []
  )
})

Deno.test('toVersionProblems - a package the base does not have passes when unpublished', () => {
  assertEquals(problemsFor(['core/mod.ts']), [])
})

Deno.test('toVersionProblems - test-only changes pass without a bump', () => {
  assertEquals(
    problemsFor(
      [
        'core/src/parse.test.ts',
        'core/src/view.test.tsx',
        'core/test/fixtures/petstore.json',
        'core/src/tests/helper.ts'
      ],
      { baseVersion: '0.32.2', published: ['@skmtc/core@0.32.2'] }
    ),
    []
  )
})

Deno.test('toVersionProblems - a deno.json-only change (cascade bump) passes', () => {
  assertEquals(
    problemsFor(['core/deno.json'], { baseVersion: '0.32.2', published: ['@skmtc/core@0.32.2'] }),
    []
  )
})

Deno.test('toVersionProblems - a private package passes without a bump', () => {
  assertEquals(
    toVersionProblems({
      packages: [langGo],
      changedFiles: ['lang-go/src/mod.ts'],
      baseVersions: new Map([['@skmtc/lang-go', '0.1.0']]),
      published: new Set()
    }),
    []
  )
})

Deno.test('toVersionProblems - changes outside the package do not count', () => {
  assertEquals(
    problemsFor(['core-extra/mod.ts', 'docs/guide.md', 'deno.lock'], {
      baseVersion: '0.32.2',
      published: ['@skmtc/core@0.32.2']
    }),
    []
  )
})

Deno.test('isShippedChange - README, docs and nested deno.json count; root deno.json and tests do not', () => {
  assertEquals(isShippedChange('core', 'core/README.md'), true)
  assertEquals(isShippedChange('core', 'core/docs/guide.md'), true)
  assertEquals(isShippedChange('core', 'core/fixtures/deno.json'), true)
  assertEquals(isShippedChange('core', 'core/src/testing.ts'), true)
  assertEquals(isShippedChange('core', 'core/deno.json'), false)
  assertEquals(isShippedChange('core', 'core/test/mod.ts'), false)
  assertEquals(isShippedChange('core', 'core/src/a.test.ts'), false)
  assertEquals(isShippedChange('core', 'core/src/a.test.tsx'), false)
  assertEquals(isShippedChange('core', 'corex/mod.ts'), false)
})

Deno.test('parseVersionCheckArgs - requires exactly --base <ref>', () => {
  assertEquals(parseVersionCheckArgs(['--base', 'origin/main']), { base: 'origin/main' })
  assertThrows(() => parseVersionCheckArgs([]), Error, 'Usage')
  assertThrows(() => parseVersionCheckArgs(['--base']), Error, 'Usage')
  assertThrows(() => parseVersionCheckArgs(['--base', '--other']), Error, 'Usage')
  assertThrows(() => parseVersionCheckArgs(['--base', 'main', 'extra']), Error, 'Usage')
})
