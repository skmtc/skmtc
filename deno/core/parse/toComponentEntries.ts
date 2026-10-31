import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasIssueType } from '@/context/generateTypes.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import { isPlainObject, toKind } from '@/parse/isPlainObject.ts'

export type ToComponentEntriesArgs<Entry, Parsed> = {
  entries: Record<string, Entry>
  /** Trail that ends in the bucket key, e.g. `components:headers`. */
  stackTrail: StackTrail
  context: ParseContextType
  /** Issue type logged for an entry that fails to parse. */
  type: OasIssueType
  /** Names the entry in the message, e.g. `Request body`. */
  label: string
  /** Parses one entry. An `undefined` result leaves the entry out. */
  parse: (args: { key: string; entry: Entry; stackTrail: StackTrail }) => Parsed | undefined
}

/**
 * Parse each entry of a `components` bucket inside its own `tryParseAt`
 * boundary. Shared by the 3.0, 3.1 and 3.2 parsers.
 *
 * An entry that is not a plain object (`null`, an array, a string), or that
 * throws while it parses, is dropped with one error of `type` at its
 * location. Consumers reference it by name, so leaving it out silently would
 * change what they render. The other entries are kept.
 */
export const toComponentEntries = <Entry, Parsed>({
  entries,
  stackTrail,
  context,
  type,
  label,
  parse
}: ToComponentEntriesArgs<Entry, Parsed>): Record<string, Parsed> => {
  const parsedEntries = Object.entries(entries).flatMap(([key, entry]): [string, Parsed][] => {
    const parsed = tryParseAt({
      stackTrail,
      key,
      context,
      type,
      parent: entry,
      fn: st => {
        if (!isPlainObject(entry)) {
          throw new Error(`${label} must be an object, got ${toKind(entry)}`)
        }

        return parse({ key, entry, stackTrail: st })
      }
    })

    return parsed === undefined ? [] : [[key, parsed]]
  })

  return Object.fromEntries(parsedEntries)
}
