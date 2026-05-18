import type { GraphQLEnumType } from 'graphql'
import { OasString } from '@/oas/string/String.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToEnumTypeArgs = {
  enumType: GraphQLEnumType
  /**
   * Whether the enum appears in a nullable position. Defaults to
   * `false` for top-level registry entries; usage sites set this based
   * on how the enum was referenced.
   */
  nullable?: boolean
  context: ParseContextType
  stackTrail: StackTrail
}

/**
 * Maps a GraphQL enum to an `OasString` with the enum's values listed
 * under `enums`.
 *
 * GraphQL enum values are always strings at the wire level, so this
 * representation is precise. Downstream generators that prefer a TS
 * literal union (`'ADMIN' | 'USER'`) or an `as const` object read this
 * the same way they handle OAS string enums.
 *
 * `context` and `stackTrail` follow the OAS parser convention and are
 * threaded for future diagnostic reporting; today the function is pure.
 */
export const toEnumType = ({
  enumType,
  nullable = false,
  context,
  stackTrail
}: ToEnumTypeArgs): OasString => {
  const values = enumType.getValues().map(v => v.value as string)
  return context.withStackTrail(stackTrail, () =>
    new OasString(
      {
        title: enumType.name,
        description: enumType.description ?? undefined,
        enums: values,
        nullable
      },
      context
    )
  )
}
