import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

type ParseEnumArgs = {
  value: unknown
  nullable: boolean | undefined
  parent: unknown
  check: (item: unknown) => boolean
  toMessage: (item: unknown) => string
  context: ParseContextType
  stackTrail: StackTrail
}

export const parseEnum = ({
  value,
  nullable,
  parent,
  context,
  check,
  toMessage,
  stackTrail
}: ParseEnumArgs) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (nullable && item === null) {
        continue
      }

      if (check(item)) {
        continue
      }

      context.logIssue({
        key: 'default',
        level: 'warning',
        message: toMessage(item),
        parent,
        stackTrail,
        type: 'INVALID_DEFAULT'
      })

      return undefined
    }

    return value
  }

  return undefined
}
