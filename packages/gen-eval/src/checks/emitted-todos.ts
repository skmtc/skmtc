import type { CodeSite, PackageFacts } from '../types.ts'

/**
 * Check 13 — informational: TODO/FIXME/XXX markers inside template
 * literals (emitted text). Generated files are overwritten every run,
 * so a stub for the consumer to fill in is silently wiped.
 * Docs: docs/emitted-todos.md
 */

export type EmittedTodosResult = { count: number; sites: CodeSite[] }

export const runEmittedTodos = (facts: PackageFacts): EmittedTodosResult => {
  const sites = facts.files.flatMap(file => file.todoSites)
  return { count: sites.length, sites }
}
