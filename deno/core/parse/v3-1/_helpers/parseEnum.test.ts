import { mockParseContext } from '@/test/mockParseContext.ts'
import { parseEnum } from './parseEnum.ts'
import { assertEquals } from '@std/assert'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { ParseContextType } from '@/context/parseTypes.ts'

Deno.test('parseEnum', async (t) => {
  await t.step('non-array inputs', async (t) => {
    await t.step('should return undefined for non-array values', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = parseEnum({
        stackTrail,
        value: 'not-an-array',
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })

    await t.step('should return undefined for null', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = parseEnum({
        stackTrail,
        value: null,
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })

    await t.step('should return undefined for undefined', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = parseEnum({
        stackTrail,
        value: undefined,
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })

    await t.step('should return undefined for objects', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = parseEnum({
        stackTrail,
        value: { key: 'value' },
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })
  })

  await t.step('valid array inputs', async (t) => {
    await t.step('should return array when all items are valid', () => {
      const stackTrail = new StackTrail(['TEST'])
      const validArray = ['one', 'two', 'three']

      const result = parseEnum({
        stackTrail,
        value: validArray,
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, validArray)
    })

    await t.step('should return array for empty array', () => {
      const stackTrail = new StackTrail(['TEST'])
      const emptyArray: string[] = []

      const result = parseEnum({
        stackTrail,
        value: emptyArray,
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, emptyArray)
    })

    await t.step('should return array with single valid item', () => {
      const stackTrail = new StackTrail(['TEST'])
      const singleItemArray = [42]

      const result = parseEnum({
        stackTrail,
        value: singleItemArray,
        nullable: false,
        parent: {},
        check: (item) => typeof item === 'number',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, singleItemArray)
    })
  })

  await t.step('nullable handling', async (t) => {
    await t.step('should accept null items when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const arrayWithNull = ['one', null, 'three']

      const result = parseEnum({
        stackTrail,
        value: arrayWithNull,
        nullable: true,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, arrayWithNull)
    })

    await t.step('should reject null items when nullable is false', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const arrayWithNull = ['one', null, 'three']

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: arrayWithNull,
        nullable: false,
        parent,
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid item: ${item}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [{
          key: 'enum',
          level: 'warning',
          message: 'Invalid item: null',
          parent,
          stackTrail,
          type: 'INVALID_ENUM',
        }],
      })

      contextSpy.restore()
    })

    await t.step('should accept array with all null when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const arrayWithNulls = [null, null, null]

      const result = parseEnum({
        stackTrail,
        value: arrayWithNulls,
        nullable: true,
        parent: {},
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, arrayWithNulls)
    })

    await t.step('should handle nullable undefined (treat as false)', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const arrayWithNull = ['one', null]

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: arrayWithNull,
        nullable: undefined,
        parent,
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid item: ${item}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })
  })

  await t.step('invalid items handling', async (t) => {
    await t.step('should log issue and return undefined for invalid item', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const arrayWithInvalid = ['one', 'two', 123, 'four']

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: arrayWithInvalid,
        nullable: false,
        parent,
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Expected string, got: ${typeof item}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [{
          key: 'enum',
          level: 'warning',
          message: 'Expected string, got: number',
          parent,
          stackTrail,
          type: 'INVALID_ENUM',
        }],
      })

      contextSpy.restore()
    })

    await t.step('should stop on first invalid item', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const arrayWithMultipleInvalid = ['one', 123, 456, 'four']

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: arrayWithMultipleInvalid,
        nullable: false,
        parent,
        check: (item) => typeof item === 'string',
        toMessage: (item) => `Invalid: ${item}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      // Should only log once (first invalid item)
      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })

    await t.step('should use custom toMessage function', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const arrayWithInvalid = [1, 2, 'invalid']

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: arrayWithInvalid,
        nullable: false,
        parent,
        check: (item) => typeof item === 'number',
        toMessage: (item) => `Custom error for: ${JSON.stringify(item)}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [{
          key: 'enum',
          level: 'warning',
          message: 'Custom error for: "invalid"',
          parent,
          stackTrail,
          type: 'INVALID_ENUM',
        }],
      })

      contextSpy.restore()
    })
  })

  await t.step('complex check functions', async (t) => {
    await t.step('should work with complex object validation', () => {
      const stackTrail = new StackTrail(['TEST'])
      const validObjects = [
        { type: 'A', value: 1 },
        { type: 'B', value: 2 },
      ]

      const result = parseEnum({
        stackTrail,
        value: validObjects,
        nullable: false,
        parent: {},
        check: (item) =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          'value' in item,
        toMessage: (item) => `Invalid object: ${JSON.stringify(item)}`,
        context: mockParseContext,
      })

      assertEquals(result, validObjects)
    })

    await t.step('should work with enum-like string validation', () => {
      const stackTrail = new StackTrail(['TEST'])
      const validEnums = ['active', 'inactive', 'pending']

      const result = parseEnum({
        stackTrail,
        value: validEnums,
        nullable: false,
        parent: {},
        check: (item) =>
          typeof item === 'string' &&
          ['active', 'inactive', 'pending'].includes(item),
        toMessage: (item) => `Invalid status: ${item}`,
        context: mockParseContext,
      })

      assertEquals(result, validEnums)
    })

    await t.step('should reject when enum-like validation fails', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const invalidEnums = ['active', 'invalid-status']

      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseEnum({
        stackTrail,
        value: invalidEnums,
        nullable: false,
        parent,
        check: (item) =>
          typeof item === 'string' &&
          ['active', 'inactive', 'pending'].includes(item),
        toMessage: (item) => `Invalid status: ${item}`,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })
  })
})
