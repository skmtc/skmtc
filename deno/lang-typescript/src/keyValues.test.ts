import { assertEquals } from '@std/assert'
import { EMPTY } from '@skmtc/core'
import { keyValues } from './keyValues.ts'

Deno.test('keyValues - formats object with properties', () => {
  const result = keyValues({
    name: { toString: () => 'string' },
    age: { toString: () => 'number' }
  })
  assertEquals(result, '{name: string,\nage: number}')
})

Deno.test('keyValues - filters empty values', () => {
  const result = keyValues({
    name: { toString: () => 'string' },
    empty: { toString: () => EMPTY }
  })
  assertEquals(result, '{name: string}')
})

Deno.test('keyValues - returns EMPTY for all empty properties', () => {
  const result = keyValues({
    empty1: { toString: () => EMPTY },
    empty2: { toString: () => '' }
  })
  assertEquals(result, EMPTY)
})

Deno.test('keyValues - returns EMPTY for empty object', () => {
  const result = keyValues({})
  assertEquals(result, EMPTY)
})

Deno.test('keyValues - handles nested objects', () => {
  const inner = { toString: () => '{x: 1}' }
  const result = keyValues({ outer: inner })
  assertEquals(result, '{outer: {x: 1}}')
})

Deno.test('keyValues - handles multiple properties', () => {
  const result = keyValues({
    id: { toString: () => 'string' },
    name: { toString: () => 'string' },
    age: { toString: () => 'number' }
  })
  assertEquals(result, '{id: string,\nname: string,\nage: number}')
})

Deno.test('keyValues - single property', () => {
  const result = keyValues({
    name: { toString: () => 'value' }
  })
  assertEquals(result, '{name: value}')
})

Deno.test('keyValues - invalid identifier keys', () => {
  const result = keyValues({
    'user-name': { toString: () => 'string' }
  })
  // keyValues doesn't quote keys - it just uses them as-is
  assertEquals(result, '{user-name: string}')
})

Deno.test('keyValues - mixed valid and invalid keys', () => {
  const result = keyValues({
    name: { toString: () => 'string' },
    'first-name': { toString: () => 'string' }
  })
  assertEquals(result.includes('name: string'), true)
  // Keys are not quoted in keyValues output
  assertEquals(result.includes('first-name: string'), true)
})

Deno.test('keyValues - empty string value', () => {
  const result = keyValues({
    name: { toString: () => '' }
  })
  assertEquals(result, EMPTY)
})
