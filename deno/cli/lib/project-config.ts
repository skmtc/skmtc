/**
 * Where a project's config file is, which deprecated names it still uses,
 * and how it is written.
 *
 * The config is `.skmtc/<project>/.settings/skmtc.config.json`. Its old
 * name, `client.json`, is still read when `skmtc.config.json` is missing,
 * and its old `settings.system` key is still read when `settings.parse`
 * is missing. `skmtc migrate config` moves a project to the new names.
 */

import { existsSync } from '@std/fs/exists'
import { basename } from '@std/path/basename'
import { join } from '@std/path/join'
import type { ClientSettings } from '@skmtc/core/Settings'

/** The name of a project's config file. */
export const CONFIG_FILE_NAME = 'skmtc.config.json'

/** The deprecated name of {@link CONFIG_FILE_NAME}. */
export const LEGACY_CONFIG_FILE_NAME = 'client.json'

/** Where a project's config file is, and which name it has. */
export type ConfigLocation = {
  /** The file the CLI reads and writes. */
  path: string
  /** Whether `path` is the deprecated `client.json`. */
  legacy: boolean
  /** `client.json`, when it exists beside `skmtc.config.json` and is ignored. */
  ignoredLegacyPath: string | undefined
}

/** The two names a project's config file can have, under `projectPath`. */
export const toConfigPaths = (projectPath: string): { path: string; legacyPath: string } => ({
  path: join(projectPath, '.settings', CONFIG_FILE_NAME),
  legacyPath: join(projectPath, '.settings', LEGACY_CONFIG_FILE_NAME)
})

/**
 * Where the config of the project at `projectPath` is: `skmtc.config.json`
 * when it exists, else `client.json` when that exists, else
 * `skmtc.config.json`, the file a command creates.
 */
export const toConfigLocation = (projectPath: string): ConfigLocation => {
  const { path, legacyPath } = toConfigPaths(projectPath)
  const hasConfig = existsSync(path, { isFile: true })
  const hasLegacy = existsSync(legacyPath, { isFile: true })

  if (hasConfig) {
    return { path, legacy: false, ignoredLegacyPath: hasLegacy ? legacyPath : undefined }
  }

  if (hasLegacy) {
    return { path: legacyPath, legacy: true, ignoredLegacyPath: undefined }
  }

  return { path, legacy: false, ignoredLegacyPath: undefined }
}

/** The path of the config file of the project at `projectPath`. */
export const toConfigPath = (projectPath: string): string => toConfigLocation(projectPath).path

/** One deprecated name a project's config still uses. */
export type ConfigDeprecation = {
  kind: 'configFile' | 'settingsKey'
  old: string
  new: string
  /** The command that moves the project to the new name. */
  fix: string
}

/** The command that migrates `projectName`. */
export const toMigrateConfigCommand = (projectName: string): string =>
  `skmtc migrate config ${projectName}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The `settings` object of a parsed config, when it has one. */
const toSettingsRecord = (config: unknown): Record<string, unknown> | undefined =>
  isRecord(config) && isRecord(config.settings) ? config.settings : undefined

type ToConfigDeprecationsArgs = {
  projectName: string
  location: ConfigLocation
  /** The parsed JSON of the config file, `undefined` when it has none. */
  config: unknown
}

/** The deprecated names the config of `projectName` uses, one entry for each. */
export const toConfigDeprecations = ({
  projectName,
  location,
  config
}: ToConfigDeprecationsArgs): ConfigDeprecation[] => {
  const fix = toMigrateConfigCommand(projectName)
  const settings = toSettingsRecord(config)

  return [
    ...(location.legacy
      ? [{ kind: 'configFile' as const, old: LEGACY_CONFIG_FILE_NAME, new: CONFIG_FILE_NAME, fix }]
      : []),
    ...(settings && 'system' in settings
      ? [{ kind: 'settingsKey' as const, old: 'settings.system', new: 'settings.parse', fix }]
      : [])
  ]
}

/** The deprecated names the config of the project at `projectPath` uses. */
export const readConfigDeprecations = (projectPath: string): ConfigDeprecation[] => {
  const location = toConfigLocation(projectPath)

  return toConfigDeprecations({
    projectName: basename(projectPath),
    location,
    config: readConfigJson(location.path)
  })
}

/** The parsed JSON at `path`; `undefined` when it is missing or is not JSON. */
const readConfigJson = (path: string): unknown => {
  try {
    return JSON.parse(Deno.readTextFileSync(path))
  } catch {
    return undefined
  }
}

const toIgnoredLegacyWarning = (projectName: string, location: ConfigLocation): string =>
  `Warning: ${projectName} has both ${CONFIG_FILE_NAME} and ${LEGACY_CONFIG_FILE_NAME} ` +
  `in .skmtc/${projectName}/.settings/. skmtc reads ${CONFIG_FILE_NAME} and ignores ` +
  `${location.ignoredLegacyPath}. Delete the one you do not want to keep: ` +
  `skmtc migrate config does not choose between them.`

const toDeprecationWarning = (projectName: string, deprecation: ConfigDeprecation): string =>
  deprecation.kind === 'configFile'
    ? `Warning: ${projectName} uses .settings/${deprecation.old}, which is deprecated: ` +
      `the config file is now .settings/${deprecation.new}. Run: ${deprecation.fix}`
    : `Warning: ${projectName} uses ${deprecation.old}, which is deprecated: ` +
      `it is now ${deprecation.new}. Run: ${deprecation.fix}`

/** What this run has warned about, so each warning prints once. */
const reported: { keys: Set<string>; deprecations: ConfigDeprecation[] } = {
  keys: new Set(),
  deprecations: []
}

type ReportConfigDeprecationsArgs = {
  projectPath: string
  location: ConfigLocation
  config: unknown
}

/**
 * Prints each deprecated name the config uses, and a `client.json` that
 * `skmtc.config.json` hides, on stderr, once per run, and keeps the
 * deprecations for a JSON result ({@link toReportedDeprecations}).
 * Stderr, so a `--json` command's stdout stays one JSON document.
 */
export const reportConfigDeprecations = ({
  projectPath,
  location,
  config
}: ReportConfigDeprecationsArgs): void => {
  const projectName = basename(projectPath)

  if (location.ignoredLegacyPath && !reported.keys.has(location.ignoredLegacyPath)) {
    reported.keys.add(location.ignoredLegacyPath)
    console.error(toIgnoredLegacyWarning(projectName, location))
  }

  toConfigDeprecations({ projectName, location, config }).forEach(deprecation => {
    const key = `${deprecation.kind}:${deprecation.fix}`

    if (reported.keys.has(key)) {
      return
    }

    reported.keys.add(key)
    reported.deprecations.push(deprecation)
    console.error(toDeprecationWarning(projectName, deprecation))
  })

  // The CLI hands the engine one key (`toEngineSettings`), so core's own
  // warning for both keys never fires in a CLI run: give it here.
  const settings = toSettingsRecord(config)
  const bothKey = `bothParseKeys:${projectPath}`

  if (settings && 'parse' in settings && 'system' in settings && !reported.keys.has(bothKey)) {
    reported.keys.add(bothKey)
    console.error(toBothParseKeysWarning(projectName, toMovedSettings(settings).conflicts))
  }
}

const toBothParseKeysWarning = (projectName: string, conflicts: string[]): string =>
  `Warning: ${projectName} sets settings.parse and settings.system: settings.parse is used and settings.system is ignored.` +
  (conflicts.length > 0 ? ` settings.system has another value for: ${conflicts.join(', ')}.` : '')

/** The deprecations this run has reported, for the `deprecations` array of a JSON result. */
export const toReportedDeprecations = (): ConfigDeprecation[] => [...reported.deprecations]

/** Forgets what this run reported. For tests. */
export const resetReportedDeprecations = (): void => {
  reported.keys.clear()
  reported.deprecations.length = 0
}

/**
 * Prints `result` as one JSON document on stdout, with the `deprecations`
 * this run reported when there are any.
 */
export const printJsonResult = (result: unknown): void => {
  const deprecations = toReportedDeprecations()
  const output = deprecations.length > 0 && isRecord(result) ? { ...result, deprecations } : result

  console.log(JSON.stringify(output, null, 2))
}

/** How the `parse` settings of a config move from `system`. */
export type MovedSettings = {
  settings: Record<string, unknown>
  /** The keys of `system` that moved into `parse`. */
  movedKeys: string[]
  /** The keys of `system` whose value is not the value `parse` already has. */
  conflicts: string[]
}

/**
 * `settings` with `system` moved to `parse`, in the place `system` had,
 * and every other key kept in its order. When `parse` is set too, it is
 * kept as it is: `system` is dropped, and each key of `system` whose value
 * differs from `parse`'s is a conflict.
 */
export const toMovedSettings = (settings: Record<string, unknown>): MovedSettings => {
  if (!('system' in settings)) {
    return { settings, movedKeys: [], conflicts: [] }
  }

  const system = settings.system

  if ('parse' in settings) {
    const parse = isRecord(settings.parse) ? settings.parse : {}
    const conflicts = isRecord(system)
      ? Object.keys(system).filter(key => toComparable(system[key]) !== toComparable(parse[key]))
      : []

    return {
      settings: Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'system')),
      movedKeys: [],
      conflicts
    }
  }

  return {
    settings: Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [key === 'system' ? 'parse' : key, value])
    ),
    movedKeys: isRecord(system) ? Object.keys(system) : [],
    conflicts: []
  }
}

/**
 * The config as a command writes it: with `parse`, never `system`
 * ({@link toMovedSettings}).
 */
export const toWrittenConfig = <Config>(config: Config): Config => {
  if (!isRecord(config) || !isRecord(config.settings) || !('system' in config.settings)) {
    return config
  }

  return { ...config, settings: toMovedSettings(config.settings).settings }
}

/**
 * The settings as the CLI hands them to a project's worker or stack server:
 * the parse settings under `system`, the key every core reads. A worker that
 * pins a core older than 0.49 reads only `system`; core 0.49 and later read
 * `parse ?? system`. When both are set, `parse` is sent, as core would pick it.
 */
export const toEngineSettings = (settings: ClientSettings | undefined): ClientSettings | undefined => {
  if (settings?.parse === undefined) {
    return settings
  }

  const { parse, system: _system, ...rest } = settings

  return { ...rest, system: parse }
}

/** A parse setting as text to compare: a list (`danglingRefs`) in any order is the same. */
const toComparable = (value: unknown): string =>
  JSON.stringify(Array.isArray(value) ? [...value].map(item => JSON.stringify(item)).sort() : value)

/** The text a command writes to a config file. */
export const toConfigFileText = (config: unknown): string =>
  JSON.stringify(toWrittenConfig(config), null, 2)
