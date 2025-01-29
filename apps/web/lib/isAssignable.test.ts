import { expect, test } from 'vitest'
import {
  isArrayAssignable,
  isAssignable,
  isBooleanAssignable,
  isIntegerAssignable,
  isNumberAssignable,
  isObjectAssignable,
  isStringAssignable
} from './isAssignable'
import type { OpenAPIV3 } from 'openapi-types'

test('number is assignable to number', () => {
  expect(
    isNumberAssignable({
      from: { type: 'number' },
      to: { type: 'number' },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('integer is assignable to number', () => {
  expect(
    isIntegerAssignable({
      from: { type: 'integer' },
      to: { type: 'number' },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('integer is assignable to integer', () => {
  expect(
    isIntegerAssignable({
      from: { type: 'integer' },
      to: { type: 'integer' },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('string is assignable to string', () => {
  expect(
    isStringAssignable({
      from: { type: 'string' },
      to: { type: 'string' },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('boolean is assignable to boolean', () => {
  expect(
    isBooleanAssignable({
      from: { type: 'boolean' },
      to: { type: 'boolean' },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('object is assignable to matching object', () => {
  expect(
    isObjectAssignable({
      from: { type: 'object', properties: { a: { type: 'string' } } },
      to: { type: 'object', properties: { a: { type: 'string' } } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('optional object property is not assignable to required object property', () => {
  expect(
    isObjectAssignable({
      from: { type: 'object', properties: { a: { type: 'string' } } },
      to: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({
    matched: false,
    path: [],
    reason: `Property 'a' is required in destination but is optional in source`
  })
})

test('required object property is assignable to optional object property', () => {
  expect(
    isObjectAssignable({
      from: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
      to: { type: 'object', properties: { a: { type: 'string' } } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('from object without all properties in to object is not assignable', () => {
  expect(
    isObjectAssignable({
      from: { type: 'object', properties: { a: { type: 'string' } } },
      to: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: false, path: [], reason: `Property 'b' is not defined in source` })
})

test('from object may contain extra properties that are not in to object', () => {
  expect(
    isObjectAssignable({
      from: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
      to: { type: 'object', properties: { a: { type: 'string' } } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('array of strings is assignable to array of strings', () => {
  expect(
    isArrayAssignable({
      from: { type: 'array', items: { type: 'string' } },
      to: { type: 'array', items: { type: 'string' } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})

test('array of strings is not assignable to array of numbers', () => {
  expect(
    isArrayAssignable({
      from: { type: 'array', items: { type: 'string' } },
      to: { type: 'array', items: { type: 'number' } },
      path: [],
      fullSchema: {} as OpenAPIV3.Document
    })
  ).toStrictEqual({
    matched: false,
    path: ['items'],
    reason: `Type 'string' is not assignable to 'number'`
  })
})

test('boolean ref is assignable to boolean', () => {
  expect(
    isAssignable({
      from: { $ref: '#/components/schemas/BooleanValue' },
      to: { type: 'boolean' },
      path: [],
      fullSchema: {
        components: {
          schemas: {
            BooleanValue: { type: 'boolean' }
          }
        }
      } as unknown as OpenAPIV3.Document
    })
  ).toStrictEqual({ matched: true, path: null, reason: null })
})
