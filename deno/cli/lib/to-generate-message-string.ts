import type { GenerationStats } from '@/lib/generationStats.ts'
import type { GqlParseIssue } from '@skmtc/core'

const formatNumber = (value: number, locales: Intl.LocalesArgument = 'en-US'): string => {
  return value.toLocaleString(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

/**
 * Renders the post-generation summary line, plus a per-issue breakdown
 * when GraphQL parsing recorded any lossy / skipped mappings.
 *
 * `parseIssues` defaults to `[]` so existing callers (OAS-only) need
 * no change. Each issue is shown on its own line so the user can see
 * exactly which schema feature was dropped or unmodellable.
 */
export const toGenerateMessageString = (
  stats: GenerationStats,
  parseIssues: GqlParseIssue[] = []
): string => {
  const { files, tokens, totalTime, errors } = stats

  const lines: string[] = [
    `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`
  ]

  if (errors.length) {
    lines.push(
      ` - ${formatNumber(errors.length)} errors detected - view runtime logs for details`
    )
  }

  if (parseIssues.length) {
    lines.push(`\nParse issues (${parseIssues.length}):`)
    for (const issue of parseIssues) {
      lines.push(` - [${issue.level}] ${issue.location}: ${issue.message} (${issue.type})`)
    }
  }

  return lines.join('\n')
}
