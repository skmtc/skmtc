/**
 * Formats a successful `generate` run for stdout. Two modes:
 *
 *   - `text`  — the human-readable summary the CLI has always emitted,
 *               via `toGenerateMessageString`. Closes friction #14
 *               (now includes `under <basePath>` if known).
 *   - `json`  — single structured object with the same data points
 *               plus the manifest path and the full file list.
 *
 * JSON shape is deliberately flat-ish and stable so agents can pin to
 * it. New fields can be added; existing fields shouldn't change shape.
 */

import type { GenerateLocalResult } from '@/lib/generate-local.ts'
import { toGenerateMessageString } from '@/lib/to-generate-message-string.ts'
import type { TypecheckResult } from '@/lib/typecheck.ts'

type PrintGenerateResultArgs = {
  result: GenerateLocalResult
  projectName: string
  basePath: string | undefined
  manifestPath: string
  /**
   * Optional post-generate type-check result. Surfaced inline in the
   * generate result (both formats) so the operator gets one
   * structured output covering both phases.
   */
  typecheck?: TypecheckResult
  format: 'text' | 'json'
}

export const printGenerateResult = ({
  result,
  projectName,
  basePath,
  manifestPath,
  typecheck,
  format
}: PrintGenerateResultArgs): void => {
  switch (format) {
    case 'json': {
      const payload = {
        type: 'generated' as const,
        projectName,
        basePath: basePath ?? null,
        manifestPath,
        stats: {
          tokens: result.stats.tokens,
          lines: result.stats.lines,
          files: result.stats.files,
          totalTimeMs: result.stats.totalTime
        },
        files: result.filePaths,
        errors: result.stats.errors,
        // Pass through ParseIssue verbatim — the shape is stable and
        // documented in `@skmtc/core` as part of the manifest schema.
        parseIssues: result.parseIssues,
        ...(typecheck ? { typecheck } : {}),
        // Gen-maps summary — present only when the post-pass ran
        // (anchors enabled via config + flag resolution). Omitted
        // entirely when off so the field's presence is the signal.
        ...(result.anchors
          ? {
              anchors: {
                enabled: true,
                outDir: result.anchors.outDir,
                filesWritten: result.anchors.filesWritten,
                totalBytes: result.anchors.totalBytes,
                generationMapEntries: result.anchors.generationMapEntries
              }
            }
          : {})
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(
        toGenerateMessageString({
          stats: result.stats,
          parseIssues: result.parseIssues,
          basePath
        })
      )
      if (typecheck) {
        printTypecheckText(typecheck)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

const printTypecheckText = (typecheck: TypecheckResult): void => {
  switch (typecheck.type) {
    case 'skipped':
      // Skipped is verbose-only — keep the default output quiet.
      return
    case 'no-tsconfig':
      console.log(`\nTypecheck skipped: ${typecheck.message}`)
      console.log(typecheck.hint)
      return
    case 'tsc-error':
      console.log(`\nTypecheck failed to run: ${typecheck.message}`)
      console.log(typecheck.hint)
      return
    case 'passed':
      console.log(
        `\nTypecheck passed (${typecheck.filesChecked} file(s) checked against ${typecheck.tsconfig}).`
      )
      return
    case 'failed':
      console.log(
        `\nTypecheck failed: ${typecheck.diagnostics.length} diagnostic(s) in ${typecheck.filesChecked} file(s).`
      )
      for (const d of typecheck.diagnostics) {
        console.log(`  ${d.file}(${d.line},${d.column}): ${d.category} TS${d.code}: ${d.message}`)
      }
      return
    default: {
      const _exhaustive: never = typecheck
      throw new Error(`Unhandled typecheck type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
