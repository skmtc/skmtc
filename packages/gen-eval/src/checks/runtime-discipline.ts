import type { PackageFacts, RuntimeViolation } from '../types.ts'

/**
 * Check 14 — generator code is valid synchronous Deno; the only side
 * effects are logs and register/insert calls. Flags node-isms
 * (process.*, require), fs APIs (Deno file ops, node:fs imports),
 * network (fetch, WebSocket), timers, and any async construct
 * (async fn, await, Promise, .then/.catch/.finally with callbacks).
 * AST-level, so async/fetch appearing as TEXT inside emitted template
 * literals is never flagged. Docs: docs/runtime-discipline.md
 */

export type RuntimeDisciplineResult = { pass: boolean; violations: RuntimeViolation[] }

export const runRuntimeDiscipline = (facts: PackageFacts): RuntimeDisciplineResult => {
  const violations = facts.files.flatMap(file => file.runtimeViolations)
  return { pass: violations.length === 0, violations }
}
