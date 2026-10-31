import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'

export type ToPresentInfoArgs<Info extends object> = {
  info: Info | null | undefined
  /** Trail that ends in the `info` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Check the document's `info` field before its fields are parsed. Shared by
 * the 3.0, 3.1 and 3.2 parsers.
 *
 * Missing, `null` or not a plain object: logs one `MISSING_INFO` warning and
 * returns `undefined`. The caller reads it as an empty title and version.
 */
export const toPresentInfo = <Info extends object>({
  info,
  stackTrail,
  context
}: ToPresentInfoArgs<Info>): Info | undefined => {
  if (!isPlainObject(info)) {
    context.logIssueNoKey({
      stackTrail,
      parent: info,
      level: 'warning',
      type: 'MISSING_INFO',
      message: 'Document has no info object; read as empty title and version'
    })

    return undefined
  }

  return info
}

export type ToInfoStringArgs = {
  value: unknown
  key: 'title' | 'version'
  parent: unknown
  /** Trail that ends in the `info` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Read `info.title` or `info.version`. A value that is not a string (missing,
 * or a YAML number such as `version: 1.0`) logs one `MISSING_INFO` warning
 * and reads as `''`.
 */
export const toInfoString = ({
  value,
  key,
  parent,
  stackTrail,
  context
}: ToInfoStringArgs): string => {
  if (typeof value === 'string') {
    return value
  }

  context.logIssue({
    key,
    stackTrail,
    parent,
    level: 'warning',
    type: 'MISSING_INFO',
    message: `Info has no string ${key}; read as ''`
  })

  return ''
}
