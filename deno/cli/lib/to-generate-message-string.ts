import type { GenerationStats } from '@/lib/generationStats.ts'
import type { ParseIssue } from '@skmtc/core'

const formatNumber = (value: number, locales: Intl.LocalesArgument = 'en-US'): string => {
  return value.toLocaleString(locales, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

type ToGenerateMessageStringArgs = {
  stats: GenerationStats
  parseIssues?: ParseIssue[]
  /**
   * Resolved basePath from client.json — used to tell the caller where
   * the generated files actually landed. Friction-#14: agents and humans
   * both spent time hunting for misplaced output when the message
   * stopped at "Generated N files".
   */
  basePath?: string
}

/**
 * Renders the post-generation summary line, plus a per-issue breakdown
 * when GraphQL parsing recorded any lossy / skipped mappings.
 *
 * `parseIssues` defaults to `[]` so existing callers (OAS-only) need
 * no change. Each issue is shown on its own line so the user can see
 * exactly which schema feature was dropped or unmodellable.
 */
export const toGenerateMessageString = ({
  stats,
  parseIssues = [],
  basePath
}: ToGenerateMessageStringArgs): string => {
  const { files, tokens, totalTime, errors } = stats

  const destination = basePath ? ` under ${basePath}` : ''

  const lines: string[] = [
    `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files${destination} in ${formatNumber(totalTime)}ms.`
  ]

  if (errors.length) {
    lines.push(` - ${formatNumber(errors.length)} errors detected - view runtime logs for details`)
  }

  if (parseIssues.length) {
    lines.push(`\nParse issues (${parseIssues.length}):`)
    for (const issue of parseIssues) {
      lines.push(
        ` - [${issue.protocol}/${issue.level}] ${issue.location}: ${issue.message} (${issue.type})`
      )
    }
  }

  return lines.join('\n')
}
