import { assertEquals, assertThrows } from '@std/assert'
import {
  createVariable,
  createType,
  createClass,
  createInterface,
  createNamespace,
  toTsKeyword,
  toTsEntityKind,
  isTsEntityKind,
  isBlockKind,
  isTypeOnlyKind
} from './createIdentifier.ts'

Deno.test('createVariable - creates untyped variable', () => {
  const identifier = createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.kind, 'variable')
  assertEquals(identifier.exported, true)
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('createVariable - creates typed variable', () => {
  const identifier = createVariable('userId', { typeName: 'string' })

  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.kind, 'variable')
})

Deno.test('createVariable - exported can be switched off', () => {
  const identifier = createVariable('helper', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('createType - creates type identifier', () => {
  const identifier = createType('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.kind, 'type')
  assertEquals(identifier.toString(), 'User')
})

Deno.test('createClass - creates class identifier', () => {
  const identifier = createClass('Models')

  assertEquals(identifier.name, 'Models')
  assertEquals(identifier.kind, 'class')
  assertEquals(identifier.exported, true)
  assertEquals(identifier.toString(), 'Models')
})

Deno.test('createInterface - creates interface identifier', () => {
  const identifier = createInterface('Model')

  assertEquals(identifier.name, 'Model')
  assertEquals(identifier.kind, 'interface')
})

Deno.test('createNamespace - creates namespace identifier', () => {
  const identifier = createNamespace('Models')

  assertEquals(identifier.name, 'Models')
  assertEquals(identifier.kind, 'namespace')
})

Deno.test('toTsKeyword - maps the TypeScript kind vocabulary', () => {
  assertEquals(toTsKeyword('variable'), 'const')
  assertEquals(toTsKeyword('type'), 'type')
  assertEquals(toTsKeyword('class'), 'class')
  assertEquals(toTsKeyword('interface'), 'interface')
  assertEquals(toTsKeyword('namespace'), 'declare namespace')
})

Deno.test('toTsKeyword - throws on a kind outside the vocabulary', () => {
  assertThrows(() => toTsKeyword('struct'), Error, 'Unknown TypeScript entity kind')
})

Deno.test('isTsEntityKind - guards the TypeScript kind vocabulary', () => {
  assertEquals(isTsEntityKind('class'), true)
  assertEquals(isTsEntityKind('namespace'), true)
  assertEquals(isTsEntityKind('struct'), false)
})

Deno.test('toTsEntityKind - narrows every TypeScript kind', () => {
  assertEquals(toTsEntityKind('variable'), 'variable')
  assertEquals(toTsEntityKind('type'), 'type')
  assertEquals(toTsEntityKind('class'), 'class')
  assertEquals(toTsEntityKind('interface'), 'interface')
  assertEquals(toTsEntityKind('namespace'), 'namespace')
  assertThrows(() => toTsEntityKind('struct'), Error, 'Unknown TypeScript entity kind')
})

Deno.test('isBlockKind - class / interface / namespace render block-form', () => {
  assertEquals(isBlockKind('class'), true)
  assertEquals(isBlockKind('interface'), true)
  assertEquals(isBlockKind('namespace'), true)
  assertEquals(isBlockKind('variable'), false)
  assertEquals(isBlockKind('type'), false)
})

Deno.test('isTypeOnlyKind - type and interface import type-only', () => {
  assertEquals(isTypeOnlyKind('type'), true)
  assertEquals(isTypeOnlyKind('interface'), true)
  assertEquals(isTypeOnlyKind('variable'), false)
  assertEquals(isTypeOnlyKind('class'), false)
  assertEquals(isTypeOnlyKind('namespace'), false)
})
