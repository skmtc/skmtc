import plugin from '../../mod.ts'

/**
 * Test-only harness. `Deno.lint.runPlugin` exists ONLY inside
 * `deno test` — it throws in `deno run` — so it is the whole reason the
 * rule tests are tests rather than a script.
 *
 * The default filename is a generator-source path, because every rule is
 * gated by `isGeneratorSource` (`src/shared/target.ts`): pass a
 * `*.test.ts` or `demo/` path to assert the gate.
 */

const GENERATOR_SOURCE = '/root/.skmtc/lab/gen-thing/src/Value.ts'

export const lint = (
  rule: string,
  source: string,
  filename: string = GENERATOR_SOURCE
): Deno.lint.Diagnostic[] =>
  Deno.lint
    .runPlugin(plugin, filename, source)
    .filter(diagnostic => diagnostic.id === `skmtc/${rule}`)

export const lintAll = (
  source: string,
  filename: string = GENERATOR_SOURCE
): Deno.lint.Diagnostic[] => Deno.lint.runPlugin(plugin, filename, source)

/** The messages one rule reports — the readable form for assertions. */
export const messagesFrom = (
  rule: string,
  source: string,
  filename: string = GENERATOR_SOURCE
): string[] => lint(rule, source, filename).map(diagnostic => diagnostic.message)
