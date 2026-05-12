/**
 * Optional post-generate type-check pass. Runs the consumer's `tsc`
 * against the freshly-emitted files and surfaces diagnostics in the
 * structured `generate` result.
 *
 * Closes friction #10: generator authors used to iterate
 * generate → pnpm types → read errors → map to generator source as
 * three separate steps. With `--typecheck` the second step folds
 * into the first.
 *
 * Owner attribution (which generator emitted which file) is not done
 * here — the manifest doesn't carry per-file ownership today. Adding
 * that is a separate piece of work in `@skmtc/core`'s `writeGeneratedFiles`
 * + manifest shape. For now we filter diagnostics to *this run's*
 * file set, which is already a big win: the user sees only errors in
 * code they just emitted, not the entire app.
 */

import { dirname, join, relative, resolve } from '@std/path'
import { existsSync } from '@std/fs/exists'

export type TypecheckResult =
  | {
      kind: 'skipped'
      reason: 'flag-not-set' | 'no-files'
      message: string
    }
  | {
      kind: 'no-tsconfig'
      message: string
      hint: string
    }
  | {
      kind: 'passed'
      tsconfig: string
      filesChecked: number
    }
  | {
      kind: 'failed'
      tsconfig: string
      filesChecked: number
      diagnostics: TypecheckDiagnostic[]
    }
  | {
      kind: 'tsc-error'
      message: string
      hint: string
    }

export type TypecheckDiagnostic = {
  /** Path relative to the SKMTC root (matches manifest.files keys). */
  file: string
  /** 1-based line number from the tsc diagnostic. */
  line: number
  /** 1-based column from the tsc diagnostic. */
  column: number
  /** TS error code, e.g. 2322 for "type X is not assignable". */
  code: number
  /** Error category — typically "error", occasionally "warning". */
  category: string
  /** Human-readable diagnostic message (the bit after `error TSxxxx:`). */
  message: string
}

type RunTypecheckArgs = {
  /** Paths (relative to SKMTC root) of every file this generate run wrote. */
  filePaths: string[]
  /**
   * Directory under which generated files live (`client.json#settings.basePath`,
   * resolved to absolute). We walk up from here looking for tsconfig.json.
   */
  basePathAbs: string | undefined
  /** Optional override pointing at a specific tsconfig.json. */
  tsconfigOverride?: string
  /**
   * Shell command for `tsc`. Defaults to `npx tsc`; override for
   * pnpm/bunx setups or to point at a specific local install.
   */
  tscCmd?: string
}

/**
 * Walks up from `start` to find the nearest `tsconfig.json`. Stops at
 * the filesystem root. Returns null if none found — the caller treats
 * that as "no tsconfig" and skips with a hint.
 */
const findTsconfig = (start: string): string | null => {
  let dir = resolve(start)
  while (true) {
    const candidate = join(dir, 'tsconfig.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Parses tsc's textual diagnostic output. Format (with `--pretty false`
 * or by default on non-TTY):
 *
 *   src/path/file.ts(23,7): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
 *
 * Multi-line follow-ups (indented) are appended to the prior
 * diagnostic's `message`.
 */
const parseTscOutput = (output: string): TypecheckDiagnostic[] => {
  const diagnostics: TypecheckDiagnostic[] = []
  const lineRe = /^(.+?)\((\d+),(\d+)\):\s+(\w+)\s+TS(\d+):\s+(.*)$/
  for (const line of output.split('\n')) {
    const match = line.match(lineRe)
    if (match) {
      diagnostics.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        category: match[4],
        code: Number(match[5]),
        message: match[6]
      })
    } else if (line.trim() && diagnostics.length > 0 && line.startsWith(' ')) {
      // Continuation line — append to the previous diagnostic's message.
      diagnostics[diagnostics.length - 1].message += '\n' + line.trim()
    }
  }
  return diagnostics
}

/**
 * Runs `tsc --noEmit` against the consumer's tsconfig and returns
 * diagnostics filtered to files this generate run actually wrote.
 *
 * Filtering matters: the consumer may have plenty of pre-existing
 * type errors elsewhere in their project — we don't want to surface
 * those in a generate result. The friction is specifically about
 * "I just generated something and want to know if it type-checks";
 * other errors are out of scope.
 */
export const runTypecheck = async ({
  filePaths,
  basePathAbs,
  tsconfigOverride,
  tscCmd = 'npx tsc'
}: RunTypecheckArgs): Promise<TypecheckResult> => {
  if (filePaths.length === 0) {
    return {
      kind: 'skipped',
      reason: 'no-files',
      message: 'No files emitted; skipping type-check.'
    }
  }

  const searchStart = tsconfigOverride
    ? dirname(resolve(tsconfigOverride))
    : basePathAbs ?? Deno.cwd()
  const tsconfig = tsconfigOverride
    ? resolve(tsconfigOverride)
    : findTsconfig(searchStart)
  if (tsconfig === null) {
    return {
      kind: 'no-tsconfig',
      message: `No tsconfig.json found walking up from ${searchStart}.`,
      hint:
        'Either run `skmtc generate` from inside the consumer app, ' +
        'or pass `--tsconfig <path>` to point at the tsconfig you want to use.'
    }
  }

  const tsconfigDir = dirname(tsconfig)
  // Shell out. Use `sh -c` so a multi-word `tscCmd` like `npx tsc`
  // tokenizes correctly without us reimplementing shell quoting.
  const cmd = new Deno.Command('sh', {
    args: ['-c', `${tscCmd} --noEmit --pretty false --project ${tsconfig}`],
    cwd: tsconfigDir,
    stdout: 'piped',
    stderr: 'piped'
  })

  let output: { stdout: Uint8Array; stderr: Uint8Array; code: number }
  try {
    output = await cmd.output()
  } catch (error) {
    return {
      kind: 'tsc-error',
      message: `Failed to run \`${tscCmd}\`: ${error instanceof Error ? error.message : String(error)}`,
      hint:
        'Make sure `tsc` is installed in the consumer project (or globally) ' +
        'and reachable via `npx tsc`. To use a different command, pass ' +
        '`--tsc-cmd "<your command>"` (e.g. `pnpm exec tsc`).'
    }
  }

  const stdout = new TextDecoder().decode(output.stdout)
  const stderr = new TextDecoder().decode(output.stderr)
  const allDiagnostics = parseTscOutput(stdout + '\n' + stderr)

  // Match each diagnostic's `file` (relative to tsconfigDir per tsc's
  // output convention) against the filePaths we emitted. We compare
  // by absolute path to avoid relative-path mismatches between
  // tsconfigDir-relative and skmtc-root-relative addressing.
  const emittedAbs = new Set(filePaths.map(p => resolve(p)))
  const ownDiagnostics: TypecheckDiagnostic[] = []
  for (const d of allDiagnostics) {
    const diagAbs = resolve(tsconfigDir, d.file)
    if (emittedAbs.has(diagAbs)) {
      // Re-express the path as SKMTC-root-relative so the result
      // shape matches `manifest.files` and `result.filePaths`.
      ownDiagnostics.push({
        ...d,
        file: relative(Deno.cwd(), diagAbs)
      })
    }
  }

  if (ownDiagnostics.length === 0) {
    return {
      kind: 'passed',
      tsconfig,
      filesChecked: filePaths.length
    }
  }
  return {
    kind: 'failed',
    tsconfig,
    filesChecked: filePaths.length,
    diagnostics: ownDiagnostics
  }
}
