import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { sanitizeIdentifier } from './sanitizeIdentifier.ts'

Deno.test('sanitizeIdentifier - safe names are untouched', () => {
  assertEquals(sanitizeIdentifier('user'), 'user')
  assertEquals(sanitizeIdentifier('User'), 'User')
  assertEquals(sanitizeIdentifier('_private'), '_private')
  assertEquals(sanitizeIdentifier('$special'), '$special')
  assertEquals(sanitizeIdentifier('user2'), 'user2')
})

Deno.test('sanitizeIdentifier - capitalised keywords are not reserved', () => {
  // The case that makes a capitalising generator safe and a decapitalising one
  // not: no JavaScript keyword is capitalised.
  assertEquals(sanitizeIdentifier('Export'), 'Export')
  assertEquals(sanitizeIdentifier('Class'), 'Class')
  assertEquals(sanitizeIdentifier('Delete'), 'Delete')
})

Deno.test('sanitizeIdentifier - keywords gain a Value suffix', () => {
  assertEquals(sanitizeIdentifier('export'), 'exportValue')
  assertEquals(sanitizeIdentifier('class'), 'classValue')
  assertEquals(sanitizeIdentifier('delete'), 'deleteValue')
  assertEquals(sanitizeIdentifier('function'), 'functionValue')
  assertEquals(sanitizeIdentifier('new'), 'newValue')
  assertEquals(sanitizeIdentifier('typeof'), 'typeofValue')
  assertEquals(sanitizeIdentifier('null'), 'nullValue')
  assertEquals(sanitizeIdentifier('true'), 'trueValue')
})

Deno.test('sanitizeIdentifier - module-reserved words are caught too', () => {
  // Reserved only under strict mode / modules — which every generated file is.
  assertEquals(sanitizeIdentifier('await'), 'awaitValue')
  assertEquals(sanitizeIdentifier('yield'), 'yieldValue')
  assertEquals(sanitizeIdentifier('let'), 'letValue')
  assertEquals(sanitizeIdentifier('static'), 'staticValue')
  assertEquals(sanitizeIdentifier('implements'), 'implementsValue')
})

Deno.test('sanitizeIdentifier - non-reserved lookalikes are untouched', () => {
  // `type`, `of` and `as` are contextual, never reserved as bindings.
  assertEquals(sanitizeIdentifier('type'), 'type')
  assertEquals(sanitizeIdentifier('of'), 'of')
  assertEquals(sanitizeIdentifier('as'), 'as')
  assertEquals(sanitizeIdentifier('status'), 'status')
})

Deno.test('sanitizeIdentifier - a leading digit gains an underscore', () => {
  assertEquals(sanitizeIdentifier('2fa'), '_2fa')
  assertEquals(sanitizeIdentifier('123'), '_123')
})

Deno.test('sanitizeIdentifier - invalid characters are dropped', () => {
  assertEquals(sanitizeIdentifier('user-name'), 'username')
  assertEquals(sanitizeIdentifier('user name'), 'username')
  assertEquals(sanitizeIdentifier('user.email'), 'useremail')
  assertEquals(sanitizeIdentifier('@scope/pkg'), 'scopepkg')
})

Deno.test('sanitizeIdentifier - an empty result still yields an identifier', () => {
  assertEquals(sanitizeIdentifier(''), '_')
  assertEquals(sanitizeIdentifier('---'), '_')
})

Deno.test('sanitizeIdentifier - stripping can expose a keyword', () => {
  // `class-` is not a valid identifier name, so it is stripped to `class`,
  // which then has to be renamed — the two repairs have to run in this order.
  assertEquals(sanitizeIdentifier('class-'), 'classValue')
})

Deno.test('sanitizeIdentifier - is idempotent', () => {
  for (const name of ['export', '2fa', 'user-name', '', 'await', 'User']) {
    assertEquals(sanitizeIdentifier(sanitizeIdentifier(name)), sanitizeIdentifier(name))
  }
})
