import { assertEquals } from '@std/assert'
import { parseModuleName } from './parseModuleName.ts'

Deno.test('parseModuleName - parses simple package', () => {
  const result = parseModuleName('lodash')
  assertEquals(result, {
    scheme: null,
    scopeName: null,
    packageName: 'lodash',
    version: null
  })
})

Deno.test('parseModuleName - parses package with version', () => {
  const result = parseModuleName('lodash@4.17.21')
  assertEquals(result, {
    scheme: null,
    scopeName: null,
    packageName: 'lodash',
    version: '4.17.21'
  })
})

Deno.test('parseModuleName - parses scoped package', () => {
  const result = parseModuleName('@company/utils')
  assertEquals(result, {
    scheme: null,
    scopeName: '@company',
    packageName: 'utils',
    version: null
  })
})

Deno.test('parseModuleName - parses scoped package with version', () => {
  const result = parseModuleName('@company/utils@2.0.0')
  assertEquals(result, {
    scheme: null,
    scopeName: '@company',
    packageName: 'utils',
    version: '2.0.0'
  })
})

Deno.test('parseModuleName - parses jsr module', () => {
  const result = parseModuleName('jsr:@std/path@1.0.0')
  assertEquals(result, {
    scheme: 'jsr',
    scopeName: '@std',
    packageName: 'path',
    version: '1.0.0'
  })
})

Deno.test('parseModuleName - parses npm module', () => {
  const result = parseModuleName('npm:lodash@^4.17.0')
  assertEquals(result, {
    scheme: 'npm',
    scopeName: null,
    packageName: 'lodash',
    version: '^4.17.0'
  })
})
