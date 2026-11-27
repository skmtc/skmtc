/**
 * In interactive mode, a command that reads a project still on a
 * deprecated config name offers to migrate it, once per project per run,
 * before the command does its work. Yes runs `skmtc migrate config
 * <project>`; no keeps the old names, and the deprecation warning.
 *
 * Never in strict or agent mode, with `--json`, without a TTY, or in
 * `migrate config` itself: the CLI's entry point turns the offer on
 * ({@link enableConfigMigrationOffer}) only when none of those hold.
 */

import {
  migrateConfigHeadless,
  toMigrateConfigLines,
  toPendingConfigMigration
} from '@/lib/migrate-config-headless.ts'
import { type ConfigDeprecation, readConfigDeprecations } from '@/lib/project-config.ts'
import { type InputMode, resolveInputMode } from '@/lib/strict-mode.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'

const offer = {
  enabled: false,
  /** The projects this run has offered to migrate. */
  offered: new Set<string>()
}

type ShouldOfferArgs = {
  /** The CLI's arguments. */
  args: readonly string[]
  /** The run's input mode: `strict` with `--json`, `--no-input`, or without a TTY. */
  inputMode: InputMode
}

/** Whether this run offers the migration: interactive mode, and not `migrate config`. */
export const shouldOfferConfigMigration = ({ args, inputMode }: ShouldOfferArgs): boolean => {
  const positional = args.filter(arg => !arg.startsWith('-'))
  const isMigrateConfig = positional[0] === 'migrate' && positional[1] === 'config'

  return inputMode === 'interactive' && !args.includes('--json') && !isMigrateConfig
}

/**
 * Whether a run with `args` offers the migration: {@link shouldOfferConfigMigration}
 * with the input mode `resolveInputMode` reads from the flags and the TTY.
 */
export const toRunOffersConfigMigration = (args: readonly string[]): boolean =>
  shouldOfferConfigMigration({
    args,
    inputMode: resolveInputMode({
      noInputFlag: args.includes('--no-input'),
      jsonFlag: args.includes('--json')
    })
  })

/** Turns the offer on or off for this run. Off until the CLI's entry point turns it on. */
export const enableConfigMigrationOffer = (enabled: boolean): void => {
  offer.enabled = enabled
  offer.offered.clear()
}

/** A project still on a deprecated name, and the names it uses. */
type PendingOffer = {
  projectName: string
  deprecations: ConfigDeprecation[]
}

/** The names in `names` once each, in their first order. */
const toUnique = (names: string[]): string[] => [...new Set(names)]

/** `a`, `a and b`, `a, b and c`. */
const toNameList = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** One question for all the projects in `pending`, naming each of them. */
const toOfferQuestion = (pending: PendingOffer[]): string => {
  const deprecations = pending.flatMap(entry => entry.deprecations)
  const oldNames = toUnique(deprecations.map(deprecation => deprecation.old))
  const newNames = toUnique(deprecations.map(deprecation => deprecation.new))
  const projectNames = pending.map(entry => entry.projectName).toSorted()

  return (
    `${toNameList(projectNames)} ${projectNames.length === 1 ? 'uses' : 'use'} ${oldNames.join(' / ')}, ` +
    `which ${oldNames.length === 1 ? 'is' : 'are'} deprecated. ` +
    `Migrate ${projectNames.length === 1 ? '' : 'them '}to ${newNames.join(' / ')} now?`
  )
}

/**
 * Asks a yes/no question that defaults to yes: `(Y/n)`. An empty answer is
 * yes; a cancelled prompt (`null`, as at the end of stdin) is no.
 */
export const askYesNo = (message: string): boolean => {
  const answer = prompt(`${message} (Y/n)`)

  return answer !== null && (answer.trim() === '' || /^y(es)?$/i.test(answer.trim()))
}

type OfferArgs = {
  projectNames: readonly string[]
  /** Asks the question; a `(Y/n)` prompt when left out. */
  ask?: (message: string) => boolean
}

/**
 * Offers to migrate the projects in `projectNames` that are still on a
 * deprecated name, with one question that names them all, when the offer
 * is on. A project offered already in this run is not asked about again.
 * A project the migration would refuse (it has both files) is not
 * offered: reading it prints the warning with the reason.
 */
export const offerConfigMigrations = async ({ projectNames, ask = askYesNo }: OfferArgs): Promise<void> => {
  if (!offer.enabled) {
    return
  }

  const pending = projectNames
    .filter(projectName => !offer.offered.has(projectName))
    .map(projectName => {
      offer.offered.add(projectName)
      return { projectName, deprecations: readConfigDeprecations(toProjectPath(projectName)) }
    })
    .filter(entry => entry.deprecations.length > 0 && toPendingConfigMigration(entry.projectName))

  if (pending.length === 0 || !ask(toOfferQuestion(pending))) {
    return
  }

  for (const { projectName } of pending) {
    try {
      const { projects } = await migrateConfigHeadless({ projectName })

      projects.flatMap(toMigrateConfigLines).forEach(line => console.log(line))
    } catch (error) {
      // A failed write (a read-only .settings/, say) keeps the old names: the command goes on.
      console.error(
        `Warning: ${projectName} was not migrated: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
