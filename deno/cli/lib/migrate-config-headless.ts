/**
 * Headless `skmtc migrate config`: moves a project's config to the new
 * names. `.settings/client.json` becomes `.settings/skmtc.config.json`,
 * and `settings.system` becomes `settings.parse`, with every other key
 * kept in its order.
 *
 * It changes nothing for a project that has both files (the owner decides
 * which to keep), and nothing for a project already on the new names.
 */

import { existsSync } from '@std/fs/exists'
import { isProjectName, toProjectPath } from '@/lib/to-project-path.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { toConfigPaths, toMovedSettings } from '@/lib/project-config.ts'

/** What `migrate config` did, or would do, to one project. */
export type MigrateConfigProjectResult = {
  project: string
  configPath: {
    /** The config file before the migration. */
    before: string
    /** The config file after it. */
    after: string
  }
  /** Whether `client.json` is renamed to `skmtc.config.json`. */
  renamedFile: boolean
  /** The keys of `settings.system` that move into `settings.parse`. */
  movedKeys: string[]
  /** The keys of `settings.system` that `settings.parse` already has with another value: `parse` is kept. */
  conflicts: string[]
  /** Whether the project already uses the new names. */
  alreadyMigrated: boolean
  dryRun: boolean
  /** Why nothing was changed, when the project has both files. */
  refused: string | undefined
}

export type MigrateConfigResult = {
  projects: MigrateConfigProjectResult[]
  /** 1 when any project was refused, else 0. */
  exitCode: 0 | 1
}

type Plan = {
  result: MigrateConfigProjectResult
  /** The text to write to `result.configPath.after`; `undefined` when nothing is written. */
  text: string | undefined
}

/** The parsed JSON at `path`; `undefined` when it is not JSON. */
const readJson = (path: string): unknown => {
  try {
    return JSON.parse(Deno.readTextFileSync(path))
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type PlanArgs = {
  projectName: string
  dryRun: boolean
}

/** What migrating `projectName` changes, without writing it. `undefined` when the project has no config. */
const planProject = ({ projectName, dryRun }: PlanArgs): Plan | undefined => {
  const { path: configPath, legacyPath } = toConfigPaths(toProjectPath(projectName))
  const hasConfig = existsSync(configPath, { isFile: true })
  const hasLegacy = existsSync(legacyPath, { isFile: true })

  const unchanged = (before: string): MigrateConfigProjectResult => ({
    project: projectName,
    configPath: { before, after: before },
    renamedFile: false,
    movedKeys: [],
    conflicts: [],
    alreadyMigrated: false,
    dryRun,
    refused: undefined
  })

  if (hasConfig && hasLegacy) {
    return {
      result: {
        ...unchanged(configPath),
        refused:
          `${projectName} has both ${configPath} and ${legacyPath}. ` +
          `Nothing was changed: delete the one you do not want to keep, then run it again.`
      },
      text: undefined
    }
  }

  if (!hasConfig && !hasLegacy) {
    return undefined
  }

  const before = hasConfig ? configPath : legacyPath
  const config = readJson(before)

  if (config === undefined) {
    return {
      result: {
        ...unchanged(before),
        refused: `${before} is not valid JSON. Nothing was changed: fix the file, then run it again.`
      },
      text: undefined
    }
  }
  const settings = isRecord(config) && isRecord(config.settings) ? config.settings : undefined
  const moved = settings ? toMovedSettings(settings) : undefined
  const changesSettings = settings !== undefined && 'system' in settings

  if (!hasLegacy && !changesSettings) {
    return { result: { ...unchanged(before), alreadyMigrated: true }, text: undefined }
  }

  const migrated = isRecord(config) && moved ? { ...config, settings: moved.settings } : config

  return {
    result: {
      ...unchanged(before),
      configPath: { before, after: configPath },
      renamedFile: hasLegacy,
      movedKeys: moved?.movedKeys ?? [],
      conflicts: moved?.conflicts ?? []
    },
    text: JSON.stringify(migrated, null, 2)
  }
}

/** A named project with no config file: refused, so a mistyped name is not a success. */
const toMissingPlan = (projectName: string, dryRun: boolean): Plan => {
  const { path } = toConfigPaths(toProjectPath(projectName))

  return {
    result: {
      project: projectName,
      configPath: { before: path, after: path },
      renamedFile: false,
      movedKeys: [],
      conflicts: [],
      alreadyMigrated: false,
      dryRun,
      refused: `${projectName} has no skmtc.config.json or client.json in .skmtc/${projectName}/.settings/.`
    },
    text: undefined
  }
}

/** Writes a plan: the new file first, then the old one goes, so a failure leaves the old file in place. */
const applyPlan = ({ result, text }: Plan): void => {
  if (text === undefined) {
    return
  }

  Deno.writeTextFileSync(result.configPath.after, text)

  if (result.configPath.before !== result.configPath.after) {
    Deno.removeSync(result.configPath.before)
  }
}

/** The project directories under `.skmtc/`, as `SkmtcRoot.open` lists them. */
const toProjectNames = (): string[] => {
  try {
    return Array.from(Deno.readDirSync(toRootPath()))
      .filter(entry => entry.isDirectory && !entry.name.startsWith('@'))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

type MigrateConfigArgs = {
  /** One project; every project under `.skmtc/` when left out. */
  projectName?: string
  dryRun?: boolean
  /**
   * Asked once, with the planned changes, before anything is written;
   * `false` writes nothing. Left out in strict or agent mode, with
   * `--force` or with `--json`: the changes are written without asking.
   */
  confirm?: (projects: MigrateConfigProjectResult[]) => boolean | Promise<boolean>
}

/** Migrates the config of `projectName`, or of every project. */
export const migrateConfigHeadless = async ({
  projectName,
  dryRun = false,
  confirm
}: MigrateConfigArgs = {}): Promise<MigrateConfigResult> => {
  const projectNames = projectName === undefined ? toProjectNames() : [projectName]
  // A project named on the command line must be a project under `.skmtc/` and
  // have a config; one found by listing `.skmtc/` may have none.
  const plans = projectNames.flatMap(name =>
    projectName !== undefined && !isProjectName(name)
      ? [toMissingPlan(name, dryRun)]
      : (planProject({ projectName: name, dryRun }) ?? (projectName === undefined ? [] : [toMissingPlan(name, dryRun)]))
  )
  const changes = plans.filter(plan => plan.text !== undefined)

  const exitCode = plans.some(plan => plan.result.refused !== undefined) ? 1 : 0
  const results = plans.map(plan => plan.result)

  if (dryRun || changes.length === 0) {
    return { projects: results, exitCode }
  }

  if (confirm && !(await confirm(changes.map(plan => plan.result)))) {
    return { projects: results.map(result => ({ ...result, dryRun: true })), exitCode }
  }

  changes.forEach(applyPlan)

  return { projects: results, exitCode }
}

/**
 * The migration of one project, when it can run: `undefined` when the
 * project is already migrated, has no config, has both files, or has a
 * config that is not JSON.
 */
export const toPendingConfigMigration = (projectName: string): MigrateConfigProjectResult | undefined => {
  const plan = planProject({ projectName, dryRun: true })

  return plan && plan.text !== undefined ? plan.result : undefined
}

/** One line for each change a project result names. */
export const toMigrateConfigLines = (result: MigrateConfigProjectResult): string[] => {
  if (result.refused !== undefined) {
    return [`${result.project}: refused. ${result.refused}`]
  }

  if (result.alreadyMigrated) {
    return [`${result.project}: No changes needed.`]
  }

  const say = (done: string, planned: string) => (result.dryRun ? planned : done)
  // Not a rename alone, so `system` goes: moved into `parse`, or dropped beside it.
  const changesSettings = !result.renamedFile || result.movedKeys.length > 0 || result.conflicts.length > 0

  return [
    `${result.project}:`,
    ...(result.renamedFile
      ? [`  ${say('renamed', 'would rename')} ${result.configPath.before} → ${result.configPath.after}`]
      : []),
    ...(result.movedKeys.length > 0
      ? [`  ${say('moved', 'would move')} settings.system → settings.parse (${result.movedKeys.join(', ')})`]
      : []),
    ...(changesSettings && result.movedKeys.length === 0
      ? [`  ${say('removed', 'would remove')} settings.system: settings.parse is kept`]
      : []),
    ...(result.conflicts.length > 0
      ? [`  settings.system had another value than settings.parse for: ${result.conflicts.join(', ')}`]
      : [])
  ]
}
