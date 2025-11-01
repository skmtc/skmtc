import type { ParseContext } from '@skmtc/core'

type ParseEnumArgs = {
  value: unknown

  nullable: boolean | undefined
  parent: unknown
  check: (item: unknown) => boolean
  toMessage: (item: unknown) => string
  context: ParseContext
}

export const parseEnum = ({
  value,
  nullable,
  parent,
  context,
  check,
  toMessage
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
        type: 'INVALID_DEFAULT'
      })

      return undefined
    }

    return value
  }

  return undefined
}
