/**
 * `generate --save`: store the schema source that a run was given, so the
 * next run needs no schema argument.
 *
 * The source is the top-level `source` of the project's config file. The
 * file is read and written as plain JSON, not through the settings schema:
 * a save must change one key and leave every other key as its owner wrote
 * it, deprecated names too.
 */

import { skmtcClientConfig } from '@skmtc/core/Settings'
import { basename } from '@std/path/basename'
import { ConfigValidationError, parseOrExplain } from '@/lib/parse-or-explain.ts'
import { toConfigFileText, toConfigLocation } from '@/lib/project-config.ts'

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
export type SkippedSource = { type: 'skipped'; source: string; configPath: string }

/** What `--save` did, as the result of a run reports it. */
export type SaveReport = SavedSource | SkippedSource

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readConfig = (path: string): Record<string, unknown> | undefined => {
  try {
    const config: unknown = JSON.parse(Deno.readTextFileSync(path))

    return isRecord(config) ? config : undefined
  } catch {
    return undefined
  }
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
  const config = readConfig(configPath)

  if (config === undefined) {
    return { type: 'no-config', configPath }
  }

  if (config.source === source) {
    return { type: 'unchanged', source, configPath }
  }

  const { source: _previous, ...rest } = config

  // `source` first, as `init` and the docs write the file.
  Deno.writeTextFileSync(configPath, toConfigFileText({ source, ...rest }))

  return { type: 'saved', source, configPath }
}
