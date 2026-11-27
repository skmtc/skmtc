/**
 * `skmtc migrate config [project]` — moves a project's config to the new
 * names: `.settings/client.json` → `.settings/skmtc.config.json`, and
 * `settings.system` → `settings.parse`. Every project under `.skmtc/` when
 * no project is named. The logic is in `lib/migrate-config-headless.ts`.
 */

import {
  migrateConfigHeadless,
  type MigrateConfigProjectResult,
  type MigrateConfigResult,
  toMigrateConfigLines
} from '@/lib/migrate-config-headless.ts'
import { type InputMode, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'

type RenderMigrateConfigArgs = {
  projectName?: string
  dryRun?: boolean
  force?: boolean
  jsonFlag?: boolean
  noInputFlag?: boolean
  /** The input mode; resolved from the flags and the TTY when left out. */
  mode?: InputMode
  /** Asks a yes/no question; the global `confirm` when left out. */
  ask?: (message: string) => boolean
}

/** Shows the planned changes and asks once; records a no in `declined`. */
const confirmChanges =
  (ask: (message: string) => boolean, declined: { value: boolean }) =>
  (projects: MigrateConfigProjectResult[]): boolean => {
    projects.flatMap(result => toMigrateConfigLines({ ...result, dryRun: true })).forEach(line => console.log(line))

    const yes = ask(`Migrate ${projects.length === 1 ? 'this project' : `these ${projects.length} projects`}?`)
    declined.value = !yes

    return yes
  }

export const renderMigrateConfig = async ({
  projectName,
  dryRun,
  force,
  jsonFlag,
  noInputFlag,
  mode = resolveInputMode({ noInputFlag, jsonFlag }),
  ask = message => confirm(message)
}: RenderMigrateConfigArgs): Promise<MigrateConfigResult> => {
  // As `skmtc push`: ask once in interactive mode; never in strict or agent
  // mode, with `--json` (strict), or with `--force`.
  const declined = { value: false }
  const result = await migrateConfigHeadless({
    projectName,
    dryRun,
    confirm: mode === 'interactive' && !force ? confirmChanges(ask, declined) : undefined
  })

  if (declined.value) {
    console.log('Nothing was changed.')
    // A refused project is still the reason for exit 1.
    result.projects
      .filter(project => project.refused !== undefined)
      .flatMap(toMigrateConfigLines)
      .forEach(line => console.error(line))
  } else {
    printMigrateConfigResult(result, resolveOutputFormat({ jsonFlag }))
  }

  return result
}

const printMigrateConfigResult = (result: MigrateConfigResult, format: 'text' | 'json'): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify({ projects: result.projects }, null, 2))
      return
    }
    case 'text': {
      if (result.projects.length === 0) {
        console.log('No projects with a config file under .skmtc/. No changes needed.')
        return
      }

      result.projects.flatMap(toMigrateConfigLines).forEach(line => {
        // A refusal is the reason for exit 1: stderr.
        if (line.includes(': refused.')) {
          console.error(line)
        } else {
          console.log(line)
        }
      })
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
