import { assertEquals } from '@std/assert/equals'
import { extractImportPaths } from '@/lib/extract-import-paths.ts'

Deno.test('extractImportPaths - extracts named imports', () => {
  const content = `
    import { join } from '@std/path/join'
    import { ensureFile } from '@std/fs/ensure-file'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['@std/fs/ensure-file', '@std/path/join'])
})

Deno.test('extractImportPaths - extracts default imports', () => {
  const content = `
    import React from 'react'
    import invariant from 'tiny-invariant'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['react', 'tiny-invariant'])
})

Deno.test('extractImportPaths - extracts namespace imports', () => {
  const content = `
    import * as path from 'path'
    import * as fs from 'fs'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['fs', 'path'])
})

Deno.test('extractImportPaths - extracts type imports', () => {
  const content = `
    import type { RootDenoJson } from '@/lib/root-deno-json.ts'
    import type { Manager } from '@skmtc/core'
  `
  const result = extractImportPaths(content)
  assertEquals(result, ['@skmtc/core'])
})

Deno.test('extractImportPaths - extracts side-effect imports', () => {
  const content = `
    import 'polyfill'
    import './styles.css'
  `
  const result = extractImportPaths(content)
  assertEquals(result, ['polyfill'])
})

Deno.test('extractImportPaths - extracts export from statements', () => {
  const content = `
    export { foo } from 'module-a'
    export * from 'module-b'
    export { bar as baz } from './local.ts'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['module-a', 'module-b'])
})

Deno.test('extractImportPaths - ignores relative imports', () => {
  const content = `
    import { something } from '@/lib/local-file.ts'
    import { another } from '@/parent-file.ts'
    import { absolute } from '/absolute/path.ts'
    import { external } from 'external-package'
  `
  const result = extractImportPaths(content)
  assertEquals(result, ['external-package'])
})

Deno.test('extractImportPaths - handles mixed import styles', () => {
  const content = `
    import React, { useState, useEffect } from 'react'
    import { match, P } from 'ts-pattern'
    import type { ComponentProps } from 'react'
    import './styles.css'
    import 'polyfill'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['polyfill', 'react', 'ts-pattern'])
})

Deno.test('extractImportPaths - handles imports with single and double quotes', () => {
  const content = `
    import { foo } from "module-a"
    import { bar } from 'module-b'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['module-a', 'module-b'])
})

Deno.test('extractImportPaths - deduplicates import paths', () => {
  const content = `
    import { foo } from 'react'
    import { bar } from 'react'
    import type { ComponentProps } from 'react'
  `
  const result = extractImportPaths(content)
  assertEquals(result, ['react'])
})

Deno.test('extractImportPaths - handles multiline imports', () => {
  const content = `
    import {
      foo,
      bar,
      baz
    } from 'multi-line-import'

    import type {
      TypeA,
      TypeB
    } from 'type-package'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['multi-line-import', 'type-package'])
})

Deno.test('extractImportPaths - handles comments and strings with import-like content', () => {
  const content = `
    // import { fake } from 'commented-out'
    /* import { also } from 'block-comment' */
    const str = "import { not } from 'in-string'"
    import { real } from 'actual-import'
  `
  const result = extractImportPaths(content)
  assertEquals(result, ['actual-import'])
})

Deno.test('extractImportPaths - handles empty content', () => {
  const result = extractImportPaths('')
  assertEquals(result, [])
})

Deno.test('extractImportPaths - handles content with no imports', () => {
  const content = `
    const foo = 'bar'
    function doSomething() {
      return 42
    }
  `
  const result = extractImportPaths(content)
  assertEquals(result, [])
})

Deno.test('extractImportPaths - handles scoped packages', () => {
  const content = `
    import { foo } from '@scope/package'
    import { bar } from '@another/scoped-pkg'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['@another/scoped-pkg', '@scope/package'])
})

Deno.test('extractImportPaths - handles package subpaths', () => {
  const content = `
    import { join } from '@std/path/join'
    import { readFile } from 'node:fs/promises'
  `
  const result = extractImportPaths(content)
  assertEquals(result.sort(), ['@std/path/join', 'node:fs/promises'])
})