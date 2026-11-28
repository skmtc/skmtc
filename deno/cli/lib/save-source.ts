/**
 * `generate --save`: store the schema source that a run was given, so the
 * next run needs no schema argument.
 *
 * The source is the top-level `source` of the project's config file. The
 * file is read and written as plain JSON, not through the settings schema:
 * a save must change one key and leave every other key as its owner wrote
 * it, deprecated names too. The file keeps its indent and its trailing
 * newline, and a `source` that was there keeps its place.
 */

import { skmtcClientConfig } from '@skmtc/core/Settings'
import { basename } from '@std/path/basename'
import { ConfigValidationError, parseOrExplain } from '@/lib/parse-or-explain.ts'
import { toConfigLocation } from '@/lib/project-config.ts'

type SaveSourceArgs = {
  projectPath: string
  /** The schema argument as the caller typed it: a URL or a path. */
  source: string
}

export type SaveSourceResult =
  | { type: 'saved'; source: string; configPath: string }
  | { type: 'unchanged'; source: string; configPath: string }
  /** The project has no config file, or it is not a JSON object. */
  | { type: 'no-config'; configPath: string }

/** A save that reached the config file. */
export type SavedSource = Exclude<SaveSourceResult, { type: 'no-config' }>

/**
 * `--save` on a run that had an error. The source is not known to work, so
 * it is not stored, and the source that was there stays.
 */
export type SkippedSource = {
  type: 'skipped'
  source: string
  configPath: string
}

/** What `--save` did, as the result of a run reports it. */
export type SaveReport = SavedSource | SkippedSource

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type ConfigFile = {
  config: Record<string, unknown>
  text: string
}

const readConfigFile = (path: string): ConfigFile | undefined => {
  try {
    const text = Deno.readTextFileSync(path)
    const config: unknown = JSON.parse(text)

    return isRecord(config) ? { config, text } : undefined
  } catch {
    return undefined
  }
}

const readConfig = (path: string): Record<string, unknown> | undefined =>
  readConfigFile(path)?.config

/**
 * The config as text in the style of the file it replaces: the indent of
 * its first indented line (none for a file on one line), and a trailing
 * newline when it had one.
 */
export const toStyledConfigText = (config: Record<string, unknown>, original: string): string => {
  const indent = original.match(/\n([ \t]+)\S/)?.[1] ?? ''
  const newline = original.endsWith('\n') ? '\n' : ''

  return `${JSON.stringify(config, null, indent)}${newline}`
}

/**
 * Why `--save` cannot store a source in the config of a project, or
 * `undefined` when it can.
 *
 * `generate` reads the config through the settings schema, and reads a file
 * that does not fit as no config at all. A source written into that file is
 * one the next run cannot find, so the save is refused before the run.
 */
export const toSaveBlocker = (projectPath: string): string | undefined => {
  const configPath = toConfigLocation(projectPath).path
  const config = readConfig(configPath)

  if (config === undefined) {
    return (
      `--save found no config to write: ${configPath} is missing or is not a JSON object.\n\n` +
      'Run `skmtc init <project> <basePath>` to create it, or repair the file, then run the command again.'
    )
  }

  try {
    parseOrExplain(skmtcClientConfig, config, `${basename(configPath)} at ${configPath}`)

    return undefined
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return (
        `--save cannot store the schema source, because the config does not fit its schema.\n\n` +
        `${error.message}\n\nRepair the file, then run the command again.`
      )
    }

    throw error
  }
}

export const saveSource = ({ projectPath, source }: SaveSourceArgs): SaveSourceResult => {
  const configPath = toConfigLocation(projectPath).path
  const file = readConfigFile(configPath)

  if (file === undefined) {
    return { type: 'no-config', configPath }
  }

  const { config, text } = file

  if (config.source === source) {
    return { type: 'unchanged', source, configPath }
  }

  // A `source` that was there keeps its place; a new one goes first, where
  // the docs show it. No other key moves or changes.
  const next = 'source' in config ? { ...config, source } : { source, ...config }

  Deno.writeTextFileSync(configPath, toStyledConfigText(next, text))

  return { type: 'saved', source, configPath }
}
