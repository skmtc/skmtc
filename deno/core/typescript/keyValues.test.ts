import { assertEquals } from '@std/assert'
import { EMPTY } from '../dsl/constants.ts'
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
