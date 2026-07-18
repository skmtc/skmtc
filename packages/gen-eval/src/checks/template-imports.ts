import type { CodeSite, PackageFacts } from '../types.ts'

/**
 * Check 12 — no import statements inside template literals. Imports are
 * always added via register calls; an import written into emitted text
 * lands in the file body and bypasses dedup. Docs: docs/template-imports.md
 */

export type TemplateImportsResult = { pass: boolean; sites: CodeSite[] }

export const runTemplateImports = (facts: PackageFacts): TemplateImportsResult => {
  const sites = facts.files.flatMap(file => file.templateImportSites)
  return { pass: sites.length === 0, sites }
}
