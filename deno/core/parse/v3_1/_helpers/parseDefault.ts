import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Arguments for parsing the `default` property from OpenAPI schemas.
 *
 * @template Value - The narrowed type a valid (non-null) default holds
 */
export type ParseDefaultArgs<Value> = {
  /** The raw `default` value extracted from the schema */
  value: unknown
  /** The parsed nullable flag — `null` is only a valid default when this is `true` */
  nullable: boolean | undefined
  /** The surrounding schema object, used as the issue location's parent */
  parent: unknown
  /** Type guard narrowing an acceptable non-null default to `Value` */
  check: (item: unknown) => item is Value
  /** Builds the warning message for a rejected default */
  toMessage: (item: unknown) => string
  /** Parse context for logging issues */
  context: ParseContextType
  /** Stack trail for tracking the current parsing location */
  stackTrail: StackTrail
}

/**
 * Parses and validates the `default` property of an OpenAPI scalar/structural
 * schema, applying the nullable-conditional rule shared by `example`, `enum`,
 * and `default`:
 *
 * - `undefined` → `undefined` (no default present)
 * - `null` → kept only when `nullable` is `true`; otherwise rejected
 * - a value passing `check` → kept
 * - anything else → logged as an `INVALID_DEFAULT` warning and dropped
 *
 * This mirrors the OpenAPI 3.0 rule that a `default` MUST conform to the
 * schema's type, where `nullable: true` widens that type to include `null`.
 * The function is fail-open: an invalid default is stripped and recorded as a
 * `ParseIssue`, never thrown.
 *
 * @template Value - The narrowed type a valid default holds
 * @param args - Parsing configuration
 * @returns The validated default (`Value`), `null` (nullable), or `undefined`
 */
export const parseDefault = <Value>({
  value,
  nullable,
  parent,
  context,
  check,
  toMessage,
  stackTrail
}: ParseDefaultArgs<Value>): Value | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (nullable && value === null) {
    return null
  }

  if (!check(value)) {
    context.logIssue({
      key: 'default',
      level: 'warning',
      message: toMessage(value),
      parent,
      stackTrail,
      type: 'INVALID_DEFAULT'
    })

    return undefined
  }

  return value
}
