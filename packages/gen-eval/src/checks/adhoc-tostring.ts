import type { CodeSite, PackageFacts } from '../types.ts'

/**
 * Check 9 — no ad-hoc `{ toString: ... }` object literals. These should
 * not exist at all: a stringable fragment is a Snippet.
 * Docs: docs/adhoc-tostring.md
 */

export type AdHocToStringResult = { pass: boolean; sites: CodeSite[] }

export const runAdHocToString = (facts: PackageFacts): AdHocToStringResult => {
  const sites = facts.files.flatMap(file => file.adHocToStringSites)
  return { pass: sites.length === 0, sites }
}
