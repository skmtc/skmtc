import { isGeneratorSource } from '../shared/target.ts'
import { toInlineText } from '../shared/nodes.ts'

/**
 * `skmtc/no-redundant-ref-guard` — call `.resolve()` unconditionally.
 *
 * Ported from gen-eval check 15
 * (`packages/gen-eval/docs/redundant-ref-guard.md`). Every concrete `Oas*`
 * schema class implements `resolve()` (and `resolveOnce()`) as
 * `return this` — resolution is identity on everything except an actual
 * `OasRef`. So
 *
 * ```ts
 * const resolved = schema.isRef() ? schema.resolve() : schema
 * ```
 *
 * encodes a false belief about the API, and each occurrence propagates it
 * to the next reader. The correct form is `schema.resolve()`.
 *
 * `.isRef()` is for genuine branching — where the two branches do
 * different things, e.g. `toRefName()` (a method only refs have) versus a
 * fallback name. Only the exact identity shape is matched, in either
 * branch order, so a real `.isRef()` ternary never fires.
 *
 * ## Known false negatives
 *
 * - The `if`/`else` statement form of the same redundancy is not
 *   detected (nor is it by the harness).
 * - `!schema.isRef() ? schema : schema.resolve()` — a negated condition —
 *   is not matched.
 * - The subject is compared as source text, so
 *   `a.b.isRef() ? a["b"].resolve() : a.b` is not matched.
 */

const RESOLVE_METHODS = new Set(['resolve', 'resolveOnce'])

const HINT =
  'resolve() and resolveOnce() are identity (return this) on every concrete schema variant — ' +
  'call resolve() unconditionally. Keep isRef() for branches that genuinely differ, e.g. ' +
  'toRefName() versus a fallback name.'

export const noRedundantRefGuard: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}
    const { sourceCode } = context

    return {
      ConditionalExpression(node) {
        const { test, consequent, alternate } = node
        if (test.type !== 'CallExpression') return
        if (test.callee.type !== 'MemberExpression') return
        if (test.callee.property.type !== 'Identifier') return
        if (test.callee.property.name !== 'isRef') return

        const subject = sourceCode.getText(test.callee.object)

        const isResolveOfSubject = (expression: Deno.lint.Expression): boolean =>
          expression.type === 'CallExpression' &&
          expression.callee.type === 'MemberExpression' &&
          expression.callee.property.type === 'Identifier' &&
          RESOLVE_METHODS.has(expression.callee.property.name) &&
          sourceCode.getText(expression.callee.object) === subject

        const isSubject = (expression: Deno.lint.Expression): boolean =>
          sourceCode.getText(expression) === subject

        const resolveBranch = isResolveOfSubject(consequent)
          ? isSubject(alternate)
            ? consequent
            : undefined
          : isResolveOfSubject(alternate) && isSubject(consequent)
            ? alternate
            : undefined

        if (resolveBranch === undefined) return

        // The whole ternary collapses to the branch that already calls
        // resolve — taking that branch's own text keeps `resolveOnce`
        // as `resolveOnce`.
        const replacement = sourceCode.getText(resolveBranch)

        context.report({
          node,
          message: `redundant isRef() guard — ${toInlineText(sourceCode, resolveBranch)} is identity on concrete schemas`,
          hint: HINT,
          fix: fixer => fixer.replaceText(node, replacement)
        })
      }
    }
  }
}
