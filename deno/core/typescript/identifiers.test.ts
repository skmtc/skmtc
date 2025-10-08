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

Deno.test('handleKey - underscore prefixed names', () => {
  assertEquals(handleKey('_private'), '_private')
  assertEquals(handleKey('__proto__'), '__proto__')
})

Deno.test('handleKey - dollar sign prefixed names', () => {
  assertEquals(handleKey('$scope'), '$scope')
  assertEquals(handleKey('$element'), '$element')
})

Deno.test('handleKey - numbers in identifiers', () => {
  assertEquals(handleKey('user1'), 'user1')
  assertEquals(handleKey('1user'), "'1user'")
  assertEquals(handleKey('user-1'), "'user-1'")
})

Deno.test('handleKey - empty string', () => {
  assertEquals(handleKey(''), "''")
})

Deno.test('handlePropertyName - underscore properties', () => {
  assertEquals(handlePropertyName('_id', 'doc'), 'doc._id')
  assertEquals(handlePropertyName('__typename', 'data'), 'data.__typename')
})

Deno.test('handlePropertyName - dollar sign properties', () => {
  assertEquals(handlePropertyName('$meta', 'result'), 'result.$meta')
})

Deno.test('handlePropertyName - mixed valid and invalid chain', () => {
  let result = 'obj'
  result = handlePropertyName('user', result)
  result = handlePropertyName('first-name', result)
  result = handlePropertyName('length', result)
  assertEquals(result, "obj.user['first-name'].length")
})
