import type { ManifestContent } from '@skmtc/core/Manifest'
import type { GqlParseIssue } from '@skmtc/core'

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
  /**
   * GraphQL parse-time issues. Always present on the wire; empty for
   * OAS runs (the OAS pipeline currently keeps its issues internal —
   * see notes/graphql-discrepancies.md item #1).
   */
  parseIssues: GqlParseIssue[]
}
