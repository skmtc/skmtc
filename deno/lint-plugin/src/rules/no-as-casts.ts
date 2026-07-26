import { isGeneratorSource } from '../shared/target.ts'
import { toInlineText } from '../shared/nodes.ts'

/**
 * `skmtc/no-as-casts` — narrow with type guards and discriminants, not
 * `as`.
 *
 * Ported from gen-eval check 10 (`packages/gen-eval/docs/as-casts.md`).
 * `as` bypasses the type system exactly where SKMTC's union-based schema
 * model (`OasSchema | OasRef<'schema'>`) is designed to force narrowing —
 * `.isRef()`, `.resolve()`, the router's `schema.type`. The house policy
 * is not zero-tolerance but approval-per-cast: an unavoidable edge case
 * is signed off explicitly, at the site, with
 * `// deno-lint-ignore skmtc/no-as-casts` and a reason.
 *
 * `as const` is excluded — it is erasable and idiomatic.
 *
 * ## Known false negatives
 *
 * - `satisfies` is not flagged (it does not lie about a type).
 * - Angle-bracket assertions (`<Foo>value`) are not flagged; they cannot
 *   appear in TSX-parsed source.
 * - A non-null assertion (`value!`) is a different escape hatch and is
 *   not this rule's concern.
 */

const HINT =
  'Narrow through the API that exists — .isRef(), .resolve(), the router schema.type — instead ' +
  'of asserting. If the cast is genuinely unavoidable, keep it and sign it off at the site with ' +
  '// deno-lint-ignore skmtc/no-as-casts plus the reason.'

/** `as const` — a const type reference, not an assertion about a type. */
const isConstAssertion = (typeAnnotation: Deno.lint.TypeNode): boolean =>
  typeAnnotation.type === 'TSTypeReference' &&
  typeAnnotation.typeName.type === 'Identifier' &&
  typeAnnotation.typeName.name === 'const'

export const noAsCasts: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    return {
      TSAsExpression(node) {
        if (isConstAssertion(node.typeAnnotation)) return
        context.report({
          node,
          message: `as cast (${toInlineText(context.sourceCode, node.typeAnnotation)}) — generator code narrows, it does not assert`,
          hint: HINT
        })
      }
    }
  }
}
