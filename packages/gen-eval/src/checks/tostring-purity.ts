import type { PackageFacts, ToStringViolation } from '../types.ts'

/**
 * Check 8 — toString() is pure: no assignments to this.*, no mutation
 * of this.* paths, no register/insert calls. toString runs multiple
 * times (Render, previews, integrity checks). Docs: docs/tostring-purity.md
 */

export type ToStringPurityResult = { pass: boolean; violations: ToStringViolation[] }

export const runToStringPurity = (facts: PackageFacts): ToStringPurityResult => {
  const violations = facts.files.flatMap(file => file.toStringViolations)
  return { pass: violations.length === 0, violations }
}
