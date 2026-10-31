import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { serializedError, toSerializedError } from '@/types/SerializedError.ts'

Deno.test('toSerializedError - keeps name, message, stack and the cause chain', () => {
  const root = new TypeError('root')
  const error = new Error('outer', { cause: root })

  assertEquals(toSerializedError(error), {
    name: 'Error',
    message: 'outer',
    stack: error.stack,
    cause: { name: 'TypeError', message: 'root', stack: root.stack }
  })
})

Deno.test('toSerializedError - the stack survives a JSON round trip', () => {
  const error = new Error('Ref "#/components/schemas/X" not found')

  const roundTripped: unknown = JSON.parse(JSON.stringify({ cause: toSerializedError(error) }))
  const parsed = v.parse(v.object({ cause: serializedError }), roundTripped)

  assertEquals(parsed.cause.name, 'Error')
  assertEquals(parsed.cause.message, 'Ref "#/components/schemas/X" not found')
  assertEquals(parsed.cause.stack, error.stack)
})

Deno.test('toSerializedError - a non-Error becomes NonError', () => {
  assertEquals(toSerializedError('text'), { name: 'NonError', message: 'text' })
  assertEquals(toSerializedError({ code: 1 }), { name: 'NonError', message: '{"code":1}' })
  assertEquals(toSerializedError(undefined), { name: 'NonError', message: 'undefined' })
  assertEquals(toSerializedError(10n), { name: 'NonError', message: '10' })
})

Deno.test('toSerializedError - follows at most five causes', () => {
  const chain = Array.from({ length: 10 }).reduce<Error>(
    (cause, _, index) => new Error(`level ${index}`, { cause }),
    new Error('bottom')
  )

  const depthOf = (error: { cause?: unknown }): number =>
    error.cause === undefined || typeof error.cause !== 'object' || error.cause === null
      ? 0
      : 1 + depthOf(error.cause)

  assertEquals(depthOf(toSerializedError(chain)), 5)
})

Deno.test('toSerializedError - a self-cycle ends without throwing', () => {
  const error = new Error('loop')
  error.cause = error

  const serialized = toSerializedError(error)

  assertEquals(serialized.message, 'loop')
  assertEquals(serialized.cause?.cause?.cause?.cause?.cause?.message, 'loop')
  assertEquals(serialized.cause?.cause?.cause?.cause?.cause?.cause, undefined)
})
