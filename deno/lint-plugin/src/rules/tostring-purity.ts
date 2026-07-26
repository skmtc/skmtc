import { isGeneratorSource } from '../shared/target.ts'
import {
  isInsideToString,
  isThisRooted,
  toCalleeName,
  toFunctionScopes,
  toInlineText
} from '../shared/nodes.ts'

/**
 * `skmtc/tostring-purity` — `toString()` is a pure read of settled state.
 *
 * Ported from gen-eval check 8 (`packages/gen-eval/docs/tostring-purity.md`).
 * A `toString()` body, including arrows nested inside it, must not:
 *
 * - assign to a `this.*` path,
 * - mutate a `this.*` path via push/add/set/unshift/splice/delete,
 * - call the register family, or
 * - construct anything (`new X(…)`).
 *
 * `toString()` runs multiple times — Render, previews, integrity checks —
 * so mutation makes output differ between calls, and a register call
 * lands after Render has finalised the file's imports and is silently
 * lost.
 *
 * ## Known false negatives
 *
 * - **Construction reached through a helper.** `new` inside a same-file
 *   helper called from `toString()` is not flagged. Flagging it would
 *   also flag a genuinely pure helper's local `new Set()`, and a rule
 *   that fires wrongly teaches the reader to ignore the linter. Only the
 *   unambiguous half of the indirection is reported: a call from
 *   `toString()` to a same-file function or same-class method whose body
 *   registers.
 * - **Two levels of indirection.** `toString()` -> helper -> helper that
 *   registers is not followed.
 * - `++`/`--` on a `this.*` path are update expressions, not
 *   assignments, and are not flagged (the harness has the same gap).
 * - A `toString` reached under an alias (`const render = this.toString`)
 *   is not recognised as a `toString` frame.
 */

const MUTATOR_VERBS = new Set(['push', 'add', 'set', 'unshift', 'splice', 'delete'])

const REGISTER_FAMILY = new Set([
  'register',
  'registerInto',
  'insertOperation',
  'insertModel',
  'insertNormalizedModel',
  'defineAndRegister'
])

const PURITY_HINT =
  'toString() is a pure read of state settled in the constructor — it runs again on every ' +
  'Render, preview and integrity check. Build the render tree, declare dependencies and ' +
  'throw refusals in the constructor; toString() only reads and interpolates.'

const REGISTER_HINT =
  'Declare dependencies at construction. A register/insert call from toString() lands after ' +
  'Render has finalised the file imports and is silently lost.'

/** `f()` or `this.f()` — a call that could reach a same-file body. */
const toLocalCallName = (callee: Deno.lint.Expression): string | undefined =>
  callee.type === 'Identifier'
    ? callee.name
    : callee.type === 'MemberExpression' &&
        callee.object.type === 'ThisExpression' &&
        callee.property.type === 'Identifier'
      ? callee.property.name
      : undefined

export const toStringPurity: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}
    const { sourceCode } = context

    // Single-level indirection: names of same-file functions and
    // same-class methods that register, and the calls to them made from
    // a toString body. Matched at Program:exit, when both are complete.
    const registeringNames = new Set<string>()
    const callsFromToString: { name: string; node: Deno.lint.CallExpression }[] = []

    return {
      NewExpression(node) {
        if (!isInsideToString(sourceCode, node)) return
        context.report({
          node,
          message: `new ${toInlineText(sourceCode, node.callee)}(…) inside toString() — the render tree is built in the constructor`,
          hint: PURITY_HINT
        })
      },

      CallExpression(node) {
        const calleeName = toCalleeName(node.callee)
        const insideToString = isInsideToString(sourceCode, node)

        if (calleeName !== undefined && REGISTER_FAMILY.has(calleeName)) {
          if (insideToString) {
            context.report({
              node,
              message: `${calleeName}(…) inside toString() — declaration must settle before render`,
              hint: REGISTER_HINT
            })
          } else {
            const owner = toFunctionScopes(sourceCode, node)
              .reverse()
              .find(scope => scope.label !== undefined)
            if (owner?.label !== undefined && owner.label !== 'toString') {
              registeringNames.add(owner.label)
            }
          }
        }

        if (!insideToString) return

        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          MUTATOR_VERBS.has(node.callee.property.name) &&
          isThisRooted(node.callee.object)
        ) {
          context.report({
            node,
            message: `${toInlineText(sourceCode, node.callee)}(…) inside toString() — state mutates between renders`,
            hint: PURITY_HINT
          })
          return
        }

        const localName = toLocalCallName(node.callee)
        if (localName !== undefined) callsFromToString.push({ name: localName, node })
      },

      AssignmentExpression(node) {
        if (!isInsideToString(sourceCode, node)) return
        if (node.left.type !== 'MemberExpression' || !isThisRooted(node.left)) return
        context.report({
          node,
          message: `${toInlineText(sourceCode, node.left)} ${node.operator} … inside toString() — state mutates between renders`,
          hint: PURITY_HINT
        })
      },

      'Program:exit'() {
        for (const call of callsFromToString) {
          if (!registeringNames.has(call.name)) continue
          context.report({
            node: call.node,
            message: `${call.name}(…) registers, and is called from toString() — declaration must settle before render`,
            hint: REGISTER_HINT
          })
        }
      }
    }
  }
}
