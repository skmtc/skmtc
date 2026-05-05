import type { GraphQLEnumType } from 'graphql'
import { OasString } from '@/oas/string/String.ts'

/**
 * Maps a GraphQL enum to an `OasString` with the enum's values listed
 * under `enums`.
 *
 * GraphQL enum values are always strings at the wire level, so this
 * representation is precise. Downstream generators that prefer a TS
 * literal union (`'ADMIN' | 'USER'`) or an `as const` object read this
 * the same way they handle OAS string enums.
 *
 * The `nullable` argument applies to the enum type as it appeared in
 * context (e.g. `Role` vs `Role!`); top-level registry entries are
 * always emitted as non-nullable, with field-position usages selecting
 * their own nullability.
 */
export const toEnumType = (
  enumType: GraphQLEnumType,
  nullable: boolean = false
): OasString => {
  const values = enumType.getValues().map(v => v.value as string)
  return new OasString({
    title: enumType.name,
    description: enumType.description ?? undefined,
    enums: values,
    nullable
  })
}
