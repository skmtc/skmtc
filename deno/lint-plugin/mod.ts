/**
 * `@skmtc/lint-plugin` — the SKMTC generator doctrine as `deno lint` rules.
 *
 * Wire it into a generator project's `deno.json`:
 *
 * ```json
 * { "lint": { "plugins": ["jsr:@skmtc/lint-plugin"] } }
 * ```
 *
 * Then `deno lint` (and the Deno LSP, live in the editor) reports each
 * violation at its site, with the rule text as the diagnostic hint. The
 * rules are ports of the per-file structural checks in
 * `packages/gen-eval/src/checks/`; the canonical rule text for each lives
 * in `packages/gen-eval/docs/<check>.md`, and each rule module carries the
 * doctrine plus its known false negatives in its doc comment.
 *
 * Cross-file and aggregate checks — producer share, package structure, the
 * accumulator verdict, string-composition share, producer sizes, and the
 * "exactly one router exists" half of single-dispatch — are not
 * expressible per-file and stay in the gen-eval harness.
 *
 * Every rule is silent in test files and under `demo/`, `examples/`,
 * `scripts/`, `dist/`, `coverage/` and `node_modules/` — trees that
 * legitimately do the things the rules forbid (see `src/shared/target.ts`).
 */

import { noAdhocToString } from './src/rules/no-adhoc-tostring.ts'
import { singleDispatch } from './src/rules/single-dispatch.ts'
import { toStringPurity } from './src/rules/tostring-purity.ts'

/**
 * The plugin. `name: 'skmtc'` makes rule ids read `skmtc/<rule>`, which is
 * what a consumer excludes in `deno.json` and what
 * `// deno-lint-ignore skmtc/<rule>` names.
 */
export const plugin: Deno.lint.Plugin = {
  name: 'skmtc',
  rules: {
    'tostring-purity': toStringPurity,
    'single-dispatch': singleDispatch,
    'no-adhoc-tostring': noAdhocToString
  }
}

export default plugin
