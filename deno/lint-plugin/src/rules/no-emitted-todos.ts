import { isGeneratorSource } from '../shared/target.ts'

/**
 * `skmtc/no-emitted-todos` — generated output is complete, or the piece is
 * not emitted at all.
 *
 * Ported from gen-eval check 13
 * (`packages/gen-eval/docs/emitted-todos.md`). Generated files are
 * overwritten on every run, so a `TODO` left for the consumer to fill in
 * is silently wiped on the next regenerate. Emit complete working output,
 * or point an import at a consumer-owned module instead — the
 * consumer-code seam.
 *
 * The harness holds this check informational (a count, not a verdict)
 * because a `TODO` in an emitted comment aimed at readers is conceivable.
 * `deno lint` has no warn severity, so it ships as an error rule that
 * consumers can drop wholesale:
 *
 * ```json
 * { "lint": { "rules": { "exclude": ["skmtc/no-emitted-todos"] } } }
 * ```
 *
 * ## Known false negatives
 *
 * - Deliberately case-sensitive and marker-only. Lowercase
 *   "placeholder" is NOT matched: `placeholder="…"` is a legitimate HTML
 *   input attribute that form generators emit constantly.
 * - A stub emitted without a marker (an empty function body, `throw new
 *   Error('not implemented')` in emitted text) is not matched.
 */

const TODO_MARKER = /\b(TODO|FIXME|XXX)\b/

const HINT =
  'A generated file is overwritten every run, so a consumer edit that fills in the stub is ' +
  'silently wiped. Emit complete working output, or emit nothing for that piece and import a ' +
  'consumer-owned module instead.'

export const noEmittedTodos: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    return {
      TemplateLiteral(node) {
        const marker = TODO_MARKER.exec(context.sourceCode.getText(node))
        if (marker === null) return
        context.report({
          node,
          message: `${marker[0]} marker in emitted text — generated files are overwritten every run`,
          hint: HINT
        })
      }
    }
  }
}
