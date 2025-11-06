import { CustomValue, isCustomValue } from './CustomValue.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

Deno.test('CustomValue - constructor creates instance with value', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'const customCode = "test";' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(customValue.value, value)
})

Deno.test('CustomValue - type property equals custom', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(customValue.type, 'custom')
})

Deno.test('CustomValue - value property is accessible', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'const result = 42;' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(customValue.value, value)
})

Deno.test('CustomValue - toString returns string representation of value', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'const customCode = "generated";' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(customValue.toString(), 'const customCode = "generated";')
})

Deno.test('CustomValue - toString works with different value types', () => {
  const mockContext = {} as GenerateContextType

  const stringValue = new CustomValue({
    context: mockContext,
    value: { toString: () => 'simple string' }
  })
  assertEquals(stringValue.toString(), 'simple string')

  const numberValue = new CustomValue({
    context: mockContext,
    value: { toString: () => '42' }
  })
  assertEquals(numberValue.toString(), '42')

  const codeValue = new CustomValue({
    context: mockContext,
    value: { toString: () => 'function test() { return true; }' }
  })
  assertEquals(codeValue.toString(), 'function test() { return true; }')
})

Deno.test('CustomValue - isRef returns false', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(customValue.isRef(), false)
})

Deno.test('CustomValue - resolve returns itself', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  const resolved = customValue.resolve()
  assertEquals(resolved, customValue)
})

Deno.test('CustomValue - resolveOnce returns itself', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  const resolved = customValue.resolveOnce()
  assertEquals(resolved, customValue)
})

Deno.test('CustomValue - constructor accepts optional generatorKey', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }
  const generatorKey = 'test-generator|custom' as GeneratorKey

  const customValue = new CustomValue({
    context: mockContext,
    value,
    generatorKey
  })

  assertEquals(customValue.generatorKey, generatorKey)
})

Deno.test('isCustomValue - returns true for CustomValue instances', () => {
  const mockContext = {} as GenerateContextType
  const value = { toString: () => 'test' }

  const customValue = new CustomValue({
    context: mockContext,
    value
  })

  assertEquals(isCustomValue(customValue), true)
})

Deno.test('isCustomValue - returns false for non-CustomValue objects', () => {
  assertEquals(isCustomValue(null), false)
  assertEquals(isCustomValue(undefined), false)
  assertEquals(isCustomValue('string'), false)
  assertEquals(isCustomValue(42), false)
  assertEquals(isCustomValue({}), false)
  assertEquals(isCustomValue({ type: 'other' }), false)
  assertEquals(isCustomValue({ type: 'custom', notACustomValue: true }), true) // Has type: 'custom'
})
