import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * A parameter entry that carries no information: `null`, or a plain object
 * with no own keys. Leaving it out cannot change how any operation renders.
 * A `$ref` entry, or an entry with at least one key, is not empty.
 */
export const isEmptyParameter = (parameter: unknown): boolean =>
  parameter === null ||
  (typeof parameter === 'object' &&
    !Array.isArray(parameter) &&
    Object.keys(parameter).length === 0)

export type LogEmptyParameterArgs = {
  parameter: unknown
  /** Trail that ends in the entry's index or name. */
  stackTrail: StackTrail
  context: ParseContextType
}

/** Log the `EMPTY_PARAMETER` warning for an entry the parser leaves out. */
export const logEmptyParameter = ({ parameter, stackTrail, context }: LogEmptyParameterArgs) => {
  context.logIssueNoKey({
    stackTrail,
    parent: parameter,
    level: 'warning',
    type: 'EMPTY_PARAMETER',
    message: 'Empty parameter object; skipped'
  })
}
