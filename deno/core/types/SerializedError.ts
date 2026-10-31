/**
 * An error as data: the name, message, stack and cause chain of a thrown
 * value, in a shape that survives `JSON.stringify` and structured clone.
 * `JSON.stringify(new Error('x'))` gives `{}`, because an `Error`'s own
 * properties are not enumerable.
 *
 * @module SerializedError
 */

import * as v from 'valibot'

/** A thrown value as data. A non-`Error` value has the name `'NonError'`. */
export type SerializedError = {
  name: string
  message: string
  stack?: string
  cause?: SerializedError
}

/** Valibot schema for {@link SerializedError}. */
export const serializedError: v.GenericSchema<SerializedError> = v.object({
  name: v.string(),
  message: v.string(),
  stack: v.optional(v.string()),
  cause: v.optional(v.lazy(() => serializedError))
})

const _serializedErrorDriftCheck: v.GenericSchema<SerializedError> = serializedError
void _serializedErrorDriftCheck

/** How many `cause` links are followed. Also ends a cycle such as `e.cause = e`. */
const MAX_CAUSE_DEPTH = 5

/**
 * Converts a thrown value to a {@link SerializedError}. An `Error` keeps its
 * name, message, stack and up to five levels of `cause`. Any other value
 * becomes `{ name: 'NonError', message }`, where `message` is the string
 * itself or the value as JSON.
 */
export const toSerializedError = (error: unknown, depth = 0): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(error.cause !== undefined && depth < MAX_CAUSE_DEPTH
        ? { cause: toSerializedError(error.cause, depth + 1) }
        : {})
    }
  }

  return { name: 'NonError', message: toNonErrorMessage(error) }
}

const toNonErrorMessage = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
