import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/** What the `allOf` merge reads of `client.json#settings.system`, and what it reports back. */
type AllOfSystem = {
  allOf: 'strict' | 'latestWins'
  /** The keywords a later member replaced under `latestWins`. */
  replaced: Set<string>
}

/**
 * The `system` settings for one merge: the `allOf` mode, `strict` when the
 * settings leave it out, and an empty set for the keywords a later member
 * replaces. Shared by the 3.0, 3.1 and 3.2 parsers.
 */
export const toAllOfSystem = (context: ParseContextType): AllOfSystem => ({
  // A test's mock context may have no `system`.
  allOf: context.system?.allOf ?? 'strict',
  replaced: new Set()
})

type LogAllOfContradictionsArgs = {
  system: AllOfSystem
  /** The trail of the schema whose members were merged. */
  stackTrail: StackTrail
  parent: unknown
  context: ParseContextType
}

/**
 * One warning for a schema whose `allOf` members contradicted, naming the
 * keywords the later member kept (`system.allOf: latestWins`). Nothing when
 * no keyword was replaced.
 */
export const logAllOfContradictions = ({ system, stackTrail, parent, context }: LogAllOfContradictionsArgs): void => {
  if (system.replaced.size === 0) {
    return
  }

  context.logIssueNoKey({
    level: 'warning',
    message: `The allOf members contradict on ${[...system.replaced].join(', ')}; the later member's values are kept (system.allOf is latestWins).`,
    parent,
    stackTrail,
    type: 'ALLOF_CONTRADICTION'
  })
}
