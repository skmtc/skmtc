import { assertEquals, assertThrows } from '@std/assert'
import {
  createDataClass,
  createEnumClass,
  createInterface,
  createSealedInterface,
  createTypeAlias,
  createValue,
  toKtKeyword
} from './createIdentifier.ts'

Deno.test('createDataClass writes the data-class kind', () => {
  const identifier = createDataClass('User')

  assertEquals(identifier.name, 'User')
  assertEquals(identifier.kind, 'data-class')
  assertEquals(identifier.exported, true)
})

Deno.test('createEnumClass writes the enum-class kind', () => {
  const identifier = createEnumClass('Status')

  assertEquals(identifier.name, 'Status')
  assertEquals(identifier.kind, 'enum-class')
})

Deno.test('createInterface writes the interface kind', () => {
  const identifier = createInterface('UsersApi')

  assertEquals(identifier.name, 'UsersApi')
  assertEquals(identifier.kind, 'interface')
})

Deno.test('createSealedInterface writes the sealed-interface kind', () => {
  const identifier = createSealedInterface('Animal')

  assertEquals(identifier.name, 'Animal')
  assertEquals(identifier.kind, 'sealed-interface')
})

Deno.test('createTypeAlias writes the typealias kind', () => {
  const identifier = createTypeAlias('UserList')

  assertEquals(identifier.name, 'UserList')
  assertEquals(identifier.kind, 'typealias')
})

Deno.test('createValue writes the val kind and carries an optional typeName', () => {
  const untyped = createValue('MAX_RETRIES')
  const typed = createValue('timeout', { typeName: 'Long' })

  assertEquals(untyped.kind, 'val')
  assertEquals(untyped.typeName, undefined)
  assertEquals(typed.typeName, 'Long')
})

Deno.test('factories honor exported: false (renders private downstream)', () => {
  const identifier = createDataClass('Internal', { exported: false })

  assertEquals(identifier.exported, false)
})

Deno.test('toKtKeyword maps the full vocabulary', () => {
  assertEquals(toKtKeyword('data-class'), 'data class')
  assertEquals(toKtKeyword('enum-class'), 'enum class')
  assertEquals(toKtKeyword('interface'), 'interface')
  assertEquals(toKtKeyword('sealed-interface'), 'sealed interface')
  assertEquals(toKtKeyword('typealias'), 'typealias')
  assertEquals(toKtKeyword('val'), 'val')
})

Deno.test('toKtKeyword throws outside the vocabulary (foreign-language identifier)', () => {
  assertThrows(() => toKtKeyword('variable'), Error, 'Unknown Kotlin entity kind: variable')
  assertThrows(() => toKtKeyword('type'), Error, 'Unknown Kotlin entity kind: type')
})
