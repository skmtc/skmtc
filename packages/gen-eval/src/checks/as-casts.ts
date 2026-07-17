import type { CodeSite, PackageFacts } from '../types.ts'

/**
 * Check 10 — `as` casts (excluding `as const`). Expected near-zero;
 * each surviving cast is an edge case requiring explicit approval.
 * Docs: docs/as-casts.md
 */

export type AsCastsResult = { count: number; sites: CodeSite[] }

export const runAsCasts = (facts: PackageFacts): AsCastsResult => {
  const sites = facts.files.flatMap(file => file.asCastSites)
  return { count: sites.length, sites: sites.slice(0, 12) }
}
