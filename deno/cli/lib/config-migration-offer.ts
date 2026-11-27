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

/** The question for a project's deprecated names. */
const toOfferQuestion = (projectName: string, deprecations: ConfigDeprecation[]): string => {
  const oldNames = deprecations.map(deprecation => deprecation.old)
  const newNames = deprecations.map(deprecation => deprecation.new)

  return (
    `${projectName} uses ${oldNames.join(' / ')}, which ${oldNames.length === 1 ? 'is' : 'are'} deprecated. ` +
    `Migrate to ${newNames.join(' / ')} now?`
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
 * Offers to migrate each project in `projectNames` that is still on a
 * deprecated name, when the offer is on and the project was not offered
 * already in this run. A project the migration would refuse (it has both
 * files) is not offered: reading it prints the warning with the reason.
 */
export const offerConfigMigrations = async ({ projectNames, ask = askYesNo }: OfferArgs): Promise<void> => {
  if (!offer.enabled) {
    return
  }

  for (const projectName of projectNames) {
    if (offer.offered.has(projectName)) {
      continue
    }

    offer.offered.add(projectName)

    const deprecations = readConfigDeprecations(toProjectPath(projectName))

    if (deprecations.length === 0 || !toPendingConfigMigration(projectName)) {
      continue
    }

    if (!ask(toOfferQuestion(projectName, deprecations))) {
      continue
    }

    const { projects } = await migrateConfigHeadless({ projectName })

    projects.flatMap(toMigrateConfigLines).forEach(line => console.log(line))
  }
}
