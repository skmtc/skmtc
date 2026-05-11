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

type PrintGenerateResultArgs = {
  result: GenerateLocalResult
  projectName: string
  basePath: string | undefined
  manifestPath: string
  format: 'text' | 'json'
}

export const printGenerateResult = ({
  result,
  projectName,
  basePath,
  manifestPath,
  format
}: PrintGenerateResultArgs): void => {
  switch (format) {
    case 'json': {
      const payload = {
        kind: 'generated' as const,
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
        parseIssues: result.parseIssues
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
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
