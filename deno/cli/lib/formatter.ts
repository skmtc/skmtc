import { basename } from '@std/path/basename'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'

/**
 * Host-side formatter integration. The engine never formats (render
 * output is canonical by design); this module runs the consumer's own
 * formatter command over freshly written artifacts so on-disk files
 * match their code style, and re-formats baseline content on demand so
 * edit detection can compare *through* the formatter.
 *
 * Commands run via `sh -c` — the compiled CLI binary is granted
 * `--allow-run=deno,sh` only, so spawning `npx`/`prettier`/etc.
 * directly would be denied. File paths are appended shell-quoted.
 *
 * Guard-rail stance: a crashing or missing formatter must never be
 * destructive. Failures warn on stderr and report `ok: false`; callers
 * fall back to comparing unformatted content.
 */

const quoteForShell = (value: string): string => {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

type RunFormatterArgs = {
  /** The consumer's command from `client.json#settings.formatter`, e.g. `"npx prettier --write"`. */
  command: string
  /** Absolute paths of the files to format in place. */
  filePaths: string[]
  /** Working directory for the command — the app root, so project-local configs and binaries resolve. */
  cwd: string
}

type RunFormatterResult = {
  ok: boolean
  error?: string
}

/**
 * Runs the formatter over `filePaths` in place. Synchronous by design:
 * the writer runs sync end-to-end so watch-mode retriggers can never
 * interleave with a write in flight, and the formatter is a barrier
 * step regardless — nothing useful proceeds while it runs.
 */
export const runFormatter = ({ command, filePaths, cwd }: RunFormatterArgs): RunFormatterResult => {
  if (filePaths.length === 0) {
    return { ok: true }
  }

  const script = `${command} ${filePaths.map(quoteForShell).join(' ')}`

  try {
    const output = new Deno.Command('sh', {
      args: ['-c', script],
      cwd,
      stdout: 'piped',
      stderr: 'piped'
    }).outputSync()

    if (!output.success) {
      const stderr = new TextDecoder().decode(output.stderr).trim()
      return { ok: false, error: stderr || `formatter exited with code ${output.code}` }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

type FormatContentArgs = {
  command: string
  /**
   * Absolute path of the real artifact this content belongs to. The
   * temp file is written *adjacent* to it (hidden name, same
   * extension chain) because formatters resolve their config and
   * language from the file's location and name.
   */
  absolutePath: string
  content: string
  cwd: string
}

/**
 * Formats a string as if it were the file at `absolutePath`, without
 * touching that file. Returns the formatted content, or `null` when
 * the formatter fails (callers degrade to unformatted comparison).
 */
export const formatContent = ({
  command,
  absolutePath,
  content,
  cwd
}: FormatContentArgs): string | null => {
  const tempPath = join(dirname(absolutePath), `.skmtc-fmt-${basename(absolutePath)}`)

  try {
    Deno.writeTextFileSync(tempPath, content)

    const result = runFormatter({ command, filePaths: [tempPath], cwd })
    if (!result.ok) {
      return null
    }

    return Deno.readTextFileSync(tempPath)
  } catch (_error) {
    return null
  } finally {
    try {
      Deno.removeSync(tempPath)
    } catch (_error) {
      // Already gone or never created
    }
  }
}
