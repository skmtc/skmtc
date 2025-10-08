import { assertEquals } from '@std/assert'
import { handleKey, handlePropertyName } from './identifiers.ts'

Deno.test('handleKey - valid identifier unchanged', () => {
  assertEquals(handleKey('name'), 'name')
  assertEquals(handleKey('userName'), 'userName')
})

Deno.test('handleKey - invalid identifier quoted', () => {
  assertEquals(handleKey('first-name'), "'first-name'")
  assertEquals(handleKey('2nd'), "'2nd'")
})

Deno.test('handlePropertyName - dot notation for valid', () => {
  assertEquals(handlePropertyName('name', 'user'), 'user.name')
})

Deno.test('handlePropertyName - bracket notation for invalid', () => {
  assertEquals(handlePropertyName('first-name', 'user'), "user['first-name']")
})

Deno.test('handleKey - handles special characters', () => {
  assertEquals(handleKey('user name'), "'user name'")
  assertEquals(handleKey('api.key'), "'api.key'")
})

Deno.test('handlePropertyName - chains multiple accesses', () => {
  const first = handlePropertyName('data', 'response')
  const second = handlePropertyName('user-id', first)
  assertEquals(second, "response.data['user-id']")
})
