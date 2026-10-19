import { mockParseContext } from '@/test/mockParseContext.ts'
import { parseExample } from './parseExample.ts'
import { assertEquals } from '@std/assert'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCall, assertSpyCalls } from '@std/testing/mock'
import type { ParseContextType } from '@/context/parseTypes.ts'

const isString = (value: unknown): value is string => typeof value === 'string'

Deno.test('parseExample', async t => {
  await t.step('returns undefined when value is undefined', () => {
    const stackTrail = new StackTrail(['TEST'])

    const result = parseExample({
      stackTrail,
      value: undefined,
      nullable: false,
      parent: {},
      check: isString,
      toMessage: item => `Invalid: ${item}`,
      context: mockParseContext
    })

    assertEquals(result, undefined)
  })

  await t.step('returns the value when it passes the check', () => {
    const stackTrail = new StackTrail(['TEST'])

    const result = parseExample({
      stackTrail,
      value: 'hello',
      nullable: false,
      parent: {},
      check: isString,
      toMessage: item => `Invalid: ${item}`,
      context: mockParseContext
    })

    assertEquals(result, 'hello')
  })

  await t.step('nullable handling', async t => {
    await t.step('keeps null when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseExample({
        stackTrail,
        value: null,
        nullable: true,
        parent: {},
        check: isString,
        toMessage: item => `Invalid: ${item}`,
        context: mockParseContext as ParseContextType
      })

      assertEquals(result, null)
      assertSpyCalls(contextSpy, 0)

      contextSpy.restore()
    })

    await t.step('rejects null when nullable is false and logs INVALID_EXAMPLE', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseExample({
        stackTrail,
        value: null,
        nullable: false,
        parent,
        check: isString,
        toMessage: item => `Removed invalid example. Expected "string", got: ${item}`,
        context: mockParseContext as ParseContextType
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [
          {
            key: 'example',
            level: 'warning',
            message: 'Removed invalid example. Expected "string", got: null',
            parent,
            stackTrail,
            type: 'INVALID_EXAMPLE'
          }
        ]
      })

      contextSpy.restore()
    })

    await t.step('rejects null when nullable is undefined', () => {
      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseExample({
        stackTrail,
        value: null,
        nullable: undefined,
        parent: {},
        check: isString,
        toMessage: item => `Invalid: ${item}`,
        context: mockParseContext as ParseContextType
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })
  })

  await t.step('invalid value handling', async t => {
    await t.step('rejects a wrong-typed value and logs INVALID_EXAMPLE', () => {
      const stackTrail = new StackTrail(['TEST'])
      const parent = {}
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseExample({
        stackTrail,
        value: 456,
        nullable: false,
        parent,
        check: isString,
        toMessage: item => `Removed invalid example. Expected "string", got: ${item}`,
        context: mockParseContext as ParseContextType
      })

      assertEquals(result, undefined)
      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [
          {
            key: 'example',
            level: 'warning',
            message: 'Removed invalid example. Expected "string", got: 456',
            parent,
            stackTrail,
            type: 'INVALID_EXAMPLE'
          }
        ]
      })

      contextSpy.restore()
    })
  })
})
