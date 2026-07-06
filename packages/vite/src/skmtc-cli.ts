// Bridge to the local `skmtc` CLI. The plugin owns no engine logic — it spawns
// the one-shot `--json` commands (`describe`, `generate`) and forwards their
// output. This is the working-tree contract from the plan: client.json in,
// generated files + manifest out, the CLI a pure function the plugin invokes.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Result of a one-shot `skmtc <cmd> --json` invocation. `data` is the parsed
 * JSON on success; on failure `message` carries the CLI's stderr — e.g. the
 * core-version-skew diagnostic `describe` prints when a project's generators
 * were built against a different `@skmtc/core` than the worker.
 */
export type CliResult = { ok: true; data: unknown } | { ok: false; code: number; message: string }

/**
 * An `execFile` rejection: an Error decorated with the child's exit `code` and
 * captured streams. `execFile` always rejects with an Error, so the predicate is
 * exact for these call sites.
 */
type ExecError = Error & { code?: number | string; stderr?: string; stdout?: string }
const isExecError = (error: unknown): error is ExecError => error instanceof Error

// Generate emits a full file list under `--json`; allow plenty of stdout.
const MAX_BUFFER = 64 * 1024 * 1024

// The CLI should keep stdout pure JSON under `--json`, but a logged per-item error
// (e.g. a ValiError on a bad enrichment) can leak in ahead of the result. Recover
// the single JSON object so the real generate result — and its `errors` — still
// surfaces, instead of the plugin reporting an opaque "Non-JSON output".
const parseCliJson = (stdout: string): unknown => {
  try {
    return JSON.parse(stdout)
  } catch {
    // Recover the result object: from each `{`, try the slice to the final `}`.
    // A leading log line that itself contains braces yields two concatenated
    // objects (invalid) and is skipped, so the real result — and its `errors` —
    // still surfaces instead of an opaque "Non-JSON output".
    const end = stdout.lastIndexOf('}')
    for (
      let start = stdout.indexOf('{');
      start >= 0 && start < end;
      start = stdout.indexOf('{', start + 1)
    ) {
      try {
        return JSON.parse(stdout.slice(start, end + 1))
      } catch {
        // not this `{` — try the next
      }
    }
    throw new Error('no JSON object in CLI output')
  }
}

const runJson = async (root: string, args: string[], timeoutMs: number): Promise<CliResult> => {
  try {
    const { stdout } = await execFileAsync('skmtc', args, {
      cwd: root,
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER
    })
    try {
      return { ok: true, data: parseCliJson(stdout) }
    } catch {
      return { ok: false, code: 0, message: `Non-JSON output from \`skmtc ${args[0]}\`` }
    }
  } catch (error) {
    if (isExecError(error)) {
      const message = (error.stderr ?? error.message).trim()
      return { ok: false, code: typeof error.code === 'number' ? error.code : 1, message }
    }
    return { ok: false, code: 1, message: String(error) }
  }
}

/** `skmtc describe <project> --json` — the read-only metadata pass (subjects +
 *  descriptors + enrichment defaults). */
export const runDescribe = (root: string, project: string): Promise<CliResult> =>
  runJson(root, ['describe', project, '--json'], 60_000)

/** `skmtc generate <project> --json` — writes generated files to `basePath` and
 *  returns the manifest summary (files, stats, errors, parseIssues). `anchors`
 *  adds `--anchors` to also emit the gen-map (`.maps/_map.ndjson`) — used on the
 *  regenerate (not edit) path, since the gen-map is heavy + stable across edits. */
export const runGenerate = (root: string, project: string, anchors = false): Promise<CliResult> =>
  runJson(root, ['generate', project, ...(anchors ? ['--anchors'] : []), '--json'], 120_000)
