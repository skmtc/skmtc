/**
 * Rewrite all `@skmtc/<pkg>` and `jsr:@skmtc/<pkg>@<ver>` specifiers
 * in a bundle to flat single-segment names (`skmtc-<pkg>.js`) so they
 * can serve as `worker_loaders` modules-Map keys.
 *
 * Why flat: the Workers loader resolves bare-looking specifiers
 * relative to the *importer's directory*, so an import of
 * `@skmtc/core` from a module named `@skmtc/server` is resolved as
 * `@skmtc/@skmtc/core`. A flat single-segment key in the same scope
 * as every importer sidesteps the path-resolution problem entirely.
 *
 * Why one normalization across bundle pairs: `deno bundle --external`
 * keeps the import string from the entry intact (bare
 * `@skmtc/core`) but rewrites transitively-discovered JSR-resolved
 * imports to `jsr:@skmtc/core@<ver>`. Without normalization, the
 * runtime and the project bundle would each reach a *different*
 * modules-Map key for the same dependency, instantiating
 * `@skmtc/core` twice and splitting its singletons.
 *
 * Ported from `skmtc-hub/spike/live-test/fixtures/normalize-specifiers.ts`
 * (the dev-fixture variant) so the deploy path and the dev-fixture
 * path share one implementation.
 */

const jsrPattern = /(["'])jsr:@skmtc\/([a-z0-9-]+)@[^"']+\1/g
const barePattern = /(["'])@skmtc\/([a-z0-9-]+)\1/g

export type NormalizeStats = {
  jsrCount: number
  bareCount: number
}

export const normalizeSpecifiers = (src: string): { out: string; stats: NormalizeStats } => {
  const jsrCount = (src.match(jsrPattern) ?? []).length
  const bareCount = (src.match(barePattern) ?? []).length
  const out = src
    .replace(jsrPattern, (_m, q, pkg) => `${q}skmtc-${pkg}.js${q}`)
    .replace(barePattern, (_m, q, pkg) => `${q}skmtc-${pkg}.js${q}`)
  return { out, stats: { jsrCount, bareCount } }
}
