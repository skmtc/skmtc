import type { GraphQLScalarType } from 'graphql'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { OasBoolean } from '@/oas/boolean/Boolean.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToScalarTypeArgs = {
  scalar: GraphQLScalarType
  nullable: boolean
  context: ParseContextType
  stackTrail: StackTrail
}

/**
 * Maps a GraphQL scalar to an `OasSchema` primitive.
 *
 * Built-in GraphQL scalars map to their natural OAS counterparts:
 * - `Int`     → `OasInteger` (`format: 'int32'`)
 * - `Float`   → `OasNumber`  (`format: 'float'`)
 * - `String`  → `OasString`
 * - `Boolean` → `OasBoolean`
 * - `ID`      → `OasString` with `format: 'id'` so generators that want
 *               to treat IDs specially can narrow on the format key.
 *
 * Custom scalars (everything else) become `OasString` with
 * `format: '<scalarName>'`. Downstream generators (`gen-typescript`,
 * `gen-zod`, etc.) consult their own `scalars` config map keyed on the
 * format string to decide the actual emitted type.
 *
 * `context` and `stackTrail` are accepted (and currently unused) so the
 * signature matches the OAS parser family; future error reporting on
 * unknown scalars or constraint conflicts can flow through `context`
 * without an API change.
 */
export const toScalarType = ({
  scalar,
  nullable,
  context: _context,
  stackTrail: _stackTrail
}: ToScalarTypeArgs): OasSchema => {
  switch (scalar.name) {
    case 'Int':
      return new OasInteger({ format: 'int32', nullable })
    case 'Float':
      return new OasNumber({ format: 'float', nullable })
    case 'String':
      return new OasString({ nullable })
    case 'Boolean':
      return new OasBoolean({ nullable })
    case 'ID':
      return new OasString({ format: 'id', nullable })
    default:
      // Custom scalar — preserve the scalar name as `format` so downstream
      // generators can map it via their `scalars` config.
      return new OasString({ format: scalar.name, nullable })
  }
}
