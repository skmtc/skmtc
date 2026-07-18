import type { CodeSite, PackageFacts } from '../types.ts'

/**
 * Check 15 — no redundant `isRef()` guards around `resolve()`.
 * `.resolve()` / `.resolveOnce()` are identity (`return this`) on every
 * concrete schema variant, so `schema.isRef() ? schema.resolve() : schema`
 * is noise — call `.resolve()` unconditionally. `.isRef()` is for
 * branches that genuinely differ (`toRefName()`).
 * Docs: docs/redundant-ref-guard.md
 */

export type RedundantRefGuardResult = { count: number; sites: CodeSite[] }

export const runRedundantRefGuards = (facts: PackageFacts): RedundantRefGuardResult => {
  const sites = facts.files.flatMap(file => file.redundantRefGuardSites)
  return { count: sites.length, sites }
}
