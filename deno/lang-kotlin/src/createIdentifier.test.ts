import { assertEquals, assertThrows } from '@std/assert'
import {
  createClass,
  createDataClass,
  createEnumClass,
  createInterface,
  createSealedInterface,
  createTypeAlias,
  createValue,
  toKtEntityType
} from './createIdentifier.ts'

Deno.test('createClass writes the class type', () => {
  const identifier = createClass('UsersController')

  assertEquals(identifier.name, 'UsersController')
  assertEquals(identifier.type, 'class')
})

Deno.test('createDataClass writes the data-class type', () => {
  const identifier = createDataClass('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.type, 'data-class')
  assertEquals(identifier.exported, true)
})

Deno.test('createEnumClass writes the enum-class type', () => {
  const identifier = createEnumClass('Status')

  assertEquals(identifier.name, 'Status')
  assertEquals(identifier.type, 'enum-class')
})

Deno.test('createInterface writes the interface type', () => {
  const identifier = createInterface('UsersApi')

  assertEquals(identifier.name, 'UsersApi')
  assertEquals(identifier.type, 'interface')
})

Deno.test('createSealedInterface writes the sealed-interface type', () => {
  const identifier = createSealedInterface('Animal')

  assertEquals(identifier.name, 'Animal')
  assertEquals(identifier.type, 'sealed-interface')
})

Deno.test('createTypeAlias writes the typealias type', () => {
  const identifier = createTypeAlias('UserList')

  assertEquals(identifier.name, 'UserList')
  assertEquals(identifier.type, 'typealias')
})

Deno.test('createValue writes the val type and carries an optional typeName', () => {
  const untyped = createValue('MAX_RETRIES')
  const typed = createValue('timeout', { typeName: 'Long' })

  assertEquals(untyped.type, 'val')
  assertEquals(untyped.typeName, undefined)
  assertEquals(typed.typeName, 'Long')
})

Deno.test('factories honor exported: false (renders private downstream)', () => {
  const identifier = createDataClass('Internal', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('toKtEntityType narrows the full vocabulary', () => {
  assertEquals(toKtEntityType('class'), 'class')
  assertEquals(toKtEntityType('data-class'), 'data-class')
  assertEquals(toKtEntityType('enum-class'), 'enum-class')
  assertEquals(toKtEntityType('interface'), 'interface')
  assertEquals(toKtEntityType('sealed-interface'), 'sealed-interface')
  assertEquals(toKtEntityType('typealias'), 'typealias')
  assertEquals(toKtEntityType('val'), 'val')
})

Deno.test('toKtEntityType throws outside the vocabulary (foreign-language identifier)', () => {
  assertThrows(() => toKtEntityType('variable'), Error, 'Unknown Kotlin entity type: variable')
  assertThrows(() => toKtEntityType('type'), Error, 'Unknown Kotlin entity type: type')
})

Deno.test('identifiers render their own declaration head (keyword + name)', () => {
  assertEquals(`${createClass('UsersController')}`, 'class UsersController')
  assertEquals(`${createDataClass('User')}`, 'data class User')
  assertEquals(`${createEnumClass('Status')}`, 'enum class Status')
  assertEquals(`${createInterface('UsersApi')}`, 'interface UsersApi')
  assertEquals(`${createSealedInterface('Animal')}`, 'sealed interface Animal')
  assertEquals(`${createTypeAlias('UserList')}`, 'typealias UserList')
  assertEquals(`${createValue('MAX_RETRIES')}`, 'val MAX_RETRIES')
})

Deno.test('a typed val renders its type annotation in the head', () => {
  assertEquals(`${createValue('timeout', { typeName: 'Long' })}`, 'val timeout: Long')
})

Deno.test('exported: false renders the private visibility prefix in the head', () => {
  assertEquals(`${createDataClass('Internal', { exported: false })}`, 'private data class Internal')
  assertEquals(`${createValue('secret', { exported: false, typeName: 'String' })}`, 'private val secret: String')
})

