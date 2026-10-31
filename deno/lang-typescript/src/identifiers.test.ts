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

const lineSeparator = String.fromCharCode(0x2028)
const paragraphSeparator = String.fromCharCode(0x2029)

const unsafeNames = [
  "it's",
  'a\\b',
  'line\nbreak',
  'carriage\rreturn',
  `line${lineSeparator}separator`,
  `paragraph${paragraphSeparator}separator`,
  "\\'"
]

/** Evaluates the `handleKey` output as an object literal key. */
const toObjectLiteral = (key: string): unknown => {
  return new Function(`return ({ ${handleKey(key)}: 1 })`)()
}

/** Evaluates the `handlePropertyName` output against an object holding `name`. */
const toAccessedValue = (name: string): unknown => {
  return new Function('o', `return ${handlePropertyName(name, 'o')}`)({ [name]: 1 })
}

Deno.test('handleKey - escapes a quote', () => {
  assertEquals(handleKey("it's"), "'it\\'s'")
})

Deno.test('handlePropertyName - escapes a backslash', () => {
  assertEquals(handlePropertyName('a\\b', 'o'), "o['a\\\\b']")
})

Deno.test('handleKey - escapes line terminators', () => {
  assertEquals(
    handleKey(`a\nb\rc${lineSeparator}d${paragraphSeparator}e`),
    "'a\\nb\\rc\\u2028d\\u2029e'"
  )
})

Deno.test('handleKey - output parses as an object literal with exactly the one key', () => {
  for (const name of unsafeNames) {
    assertEquals(toObjectLiteral(name), { [name]: 1 })
  }
})

Deno.test('handlePropertyName - output parses as access to the named property', () => {
  for (const name of unsafeNames) {
    assertEquals(toAccessedValue(name), 1)
  }
})
