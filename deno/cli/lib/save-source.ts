/**
 * `generate --save`: store the schema source that a run was given, so the
 * next run needs no schema argument.
 *
 * The source is the top-level `source` of the project's config file. The
 * file is read and written as plain JSON, not through the settings schema:
 * a save must change one key and leave every other key as its owner wrote
 * it, deprecated names too.
 */

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
