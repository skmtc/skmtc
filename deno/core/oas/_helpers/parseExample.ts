import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Arguments for parsing the `example` property from OpenAPI schemas.
 *
 * @template Value - The narrowed type a valid (non-null) example holds
 */
export type ParseExampleArgs<Value> = {
  /** The raw `example` value extracted from the schema */
  value: unknown
  /** The parsed nullable flag — `null` is only a valid example when this is `true` */
  nullable: boolean | undefined
  /** The surrounding schema object, used as the issue location's parent */
  parent: unknown
  /** Type guard narrowing an acceptable non-null example to `Value` */
  check: (item: unknown) => item is Value
  /** Builds the warning message for a rejected example */
  toMessage: (item: unknown) => string
  /** Parse context for logging issues */
  context: ParseContextType
  /** Stack trail for tracking the current parsing location */
  stackTrail: StackTrail
}

/**
 * Parses and validates the `example` property of an OpenAPI scalar/structural
 * schema, applying the nullable-conditional rule shared by `example`, `enum`,
 * and `default`:
 *
 * - `undefined` → `undefined` (no example present)
 * - `null` → kept only when `nullable` is `true`; otherwise rejected
 * - a value passing `check` → kept
 * - anything else → logged as an `INVALID_EXAMPLE` warning and dropped
 *
 * The function is fail-open: an invalid example is stripped and recorded as a
 * `ParseIssue`, never thrown.
 *
 * @template Value - The narrowed type a valid example holds
 * @param args - Parsing configuration
 * @returns The validated example (`Value`), `null` (nullable), or `undefined`
 */
export const parseExample = <Value>({
  value,
  nullable,
  parent,
  context,
  check,
  toMessage,
  stackTrail
}: ParseExampleArgs<Value>): Value | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (nullable && value === null) {
    return null
  }

  if (!check(value)) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: toMessage(value),
      parent,
      stackTrail,
      type: 'INVALID_EXAMPLE'
    })

    return undefined
  }

  return value
}
