import { assertEquals, assertThrows } from '@std/assert'
import {
  createVariable,
  createType,
  createClass,
  createInterface,
  createNamespace,
  toTsKeyword,
  toTsEntityType,
  isTsEntityType,
  isBlockType,
  isTypeOnly
} from './createIdentifier.ts'

Deno.test('createVariable - creates untyped variable', () => {
  const identifier = createVariable('userName')

  assertEquals(identifier.name, 'userName')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.type, 'variable')
  assertEquals(identifier.exported, true)
  assertEquals(identifier.toString(), 'userName')
})

Deno.test('createVariable - creates typed variable', () => {
  const identifier = createVariable('userId', { typeName: 'string' })

  assertEquals(identifier.typeName, 'string')
  assertEquals(identifier.type, 'variable')
})

Deno.test('createVariable - exported can be switched off', () => {
  const identifier = createVariable('helper', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('createType - creates type identifier', () => {
  const identifier = createType('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.typeName, undefined)
  assertEquals(identifier.type, 'type')
  assertEquals(identifier.toString(), 'User')
})

Deno.test('createClass - creates class identifier', () => {
  const identifier = createClass('Models')

  assertEquals(identifier.name, 'Models')
  assertEquals(identifier.type, 'class')
  assertEquals(identifier.exported, true)
  assertEquals(identifier.toString(), 'Models')
})

Deno.test('createInterface - creates interface identifier', () => {
  const identifier = createInterface('Model')

  assertEquals(identifier.name, 'Model')
  assertEquals(identifier.type, 'interface')
})

Deno.test('createNamespace - creates namespace identifier', () => {
  const identifier = createNamespace('Models')

  assertEquals(identifier.name, 'Models')
  assertEquals(identifier.type, 'namespace')
})

Deno.test('toTsKeyword - maps the TypeScript type vocabulary', () => {
  assertEquals(toTsKeyword('variable'), 'const')
  assertEquals(toTsKeyword('type'), 'type')
  assertEquals(toTsKeyword('class'), 'class')
  assertEquals(toTsKeyword('interface'), 'interface')
  assertEquals(toTsKeyword('namespace'), 'declare namespace')
})

Deno.test('toTsKeyword - throws on a type outside the vocabulary', () => {
  assertThrows(() => toTsKeyword('struct'), Error, 'Unknown TypeScript entity type')
})

Deno.test('isTsEntityType - guards the TypeScript type vocabulary', () => {
  assertEquals(isTsEntityType('class'), true)
  assertEquals(isTsEntityType('namespace'), true)
  assertEquals(isTsEntityType('struct'), false)
})

Deno.test('toTsEntityType - narrows every TypeScript type', () => {
  assertEquals(toTsEntityType('variable'), 'variable')
  assertEquals(toTsEntityType('type'), 'type')
  assertEquals(toTsEntityType('class'), 'class')
  assertEquals(toTsEntityType('interface'), 'interface')
  assertEquals(toTsEntityType('namespace'), 'namespace')
  assertThrows(() => toTsEntityType('struct'), Error, 'Unknown TypeScript entity type')
})

Deno.test('isBlockType - class / interface / namespace render block-form', () => {
  assertEquals(isBlockType('class'), true)
  assertEquals(isBlockType('interface'), true)
  assertEquals(isBlockType('namespace'), true)
  assertEquals(isBlockType('variable'), false)
  assertEquals(isBlockType('type'), false)
})

Deno.test('isTypeOnly - type and interface import type-only', () => {
  assertEquals(isTypeOnly('type'), true)
  assertEquals(isTypeOnly('interface'), true)
  assertEquals(isTypeOnly('variable'), false)
  assertEquals(isTypeOnly('class'), false)
  assertEquals(isTypeOnly('namespace'), false)
})
