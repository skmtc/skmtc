import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import type { LogLine } from '@skmtc/core/LogLine'

type WriteLogLinesArgs = {
  /** Path of the project's `manifest.json`; the log file goes beside it. */
  manifestPath: string
  /** The run's log lines, or `undefined` when the bundle's core returns none. */
  logs: LogLine[] | undefined
}

/** `logs.ndjson` beside `manifestPath`. */
export const toLogLinesPath = (manifestPath: string): string =>
  join(dirname(manifestPath), 'logs.ndjson')

/**
 * Writes the run's log lines to `logs.ndjson` beside the manifest, one
 * JSON object per line, replacing the previous run's file. The file is
 * empty when the run logged nothing. When `logs` is `undefined` (a bundle
 * that pins an older core), any old file is removed, so a run without
 * lines does not leave the lines of an earlier run beside its manifest.
 */
export const writeLogLines = ({ manifestPath, logs }: WriteLogLinesArgs): void => {
  const logLinesPath = toLogLinesPath(manifestPath)

  if (logs === undefined) {
    if (existsSync(logLinesPath)) {
      Deno.removeSync(logLinesPath)
    }
    return
  }

  Deno.writeTextFileSync(logLinesPath, logs.map(line => `${JSON.stringify(line)}\n`).join(''))
}
