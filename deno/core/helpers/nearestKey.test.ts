import { assertEquals } from '@std/assert'
import { nearestKey } from './nearestKey.ts'

Deno.test('nearestKey - single-character typo in a long key is suggested', () => {
  assertEquals(nearestKey('submitLabl', ['title', 'submitLabel', 'fields']), 'submitLabel')
})

Deno.test('nearestKey - transposition within budget is suggested', () => {
  assertEquals(nearestKey('tilte', ['title', 'fields']), 'title')
})

Deno.test('nearestKey - short keys get a tighter budget', () => {
  // 'pst' → 'post' is one edit; suggested even at the short-key budget.
  assertEquals(nearestKey('pst', ['get', 'post', 'put']), 'post')
  // 'get' → 'put' is two edits; not suggested for a 3-char target.
  assertEquals(nearestKey('gxt', ['put']), undefined)
})

Deno.test('nearestKey - case-only mismatch is always suggested', () => {
  assertEquals(nearestKey('POST', ['get', 'post', 'put']), 'post')
  assertEquals(nearestKey('USER', ['User']), 'User')
})

Deno.test('nearestKey - unrelated keys produce no suggestion', () => {
  assertEquals(nearestKey('submitLabl', ['fields', 'description']), undefined)
})

Deno.test('nearestKey - exact match produces no suggestion', () => {
  assertEquals(nearestKey('title', ['title', 'titles']), undefined)
})

Deno.test('nearestKey - empty candidate list produces no suggestion', () => {
  assertEquals(nearestKey('anything', []), undefined)
})

Deno.test('nearestKey - closest of several candidates wins', () => {
  assertEquals(nearestKey('labels', ['label', 'labelss', 'title']), 'label')
})
