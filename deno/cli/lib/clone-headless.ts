/**
 * Headless `clone` path — the data-mutation part of `skmtc clone`
 * without any Ink rendering. Strict mode invokes this directly; the
 * Ink `CloneGeneratorView` collects the same args via a MultiSelect
 * picker and then takes an identical path through
 * `project.cloneGenerator()`.
 *
 * Source of truth is JSR (the same registry `install` uses), pinned
 * to the version that satisfies the user-supplied semver constraint
 * (or JSR-latest if omitted). The resolved version is surfaced on
 * the result so callers can report `@scope/pkg@version` instead of
 * just `@scope/pkg`.
 *
 * Closes friction #25 (the Ink view was the only way to name the
 * generators to clone — no positional / flag form existed).
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleHeadless, type BundleHeadlessResult } from '@/lib/bundle-headless.ts'

type CloneHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
  /**
   * Bypass the pre-flight `@skmtc/core` peer-pin check. Default
   * behavior refuses to clone into a project whose pin doesn't
   * share a major.minor with the CLI's — cloning over a mismatch
   * produces a generator that won't bundle. `--force` is the escape
   * hatch when the operator has already accepted the risk (e.g.
   * intentionally testing an old CLI against new generator source).
   */
  force?: boolean
}

export type ClonedGenerator = {
  /** Module name with scope, e.g. `@skmtc/gen-shadcn-form`. */
  moduleName: string
  /** Concrete JSR version that was downloaded, e.g. `0.0.55`. */
  version: string
}

export type CloneHeadlessResult = {
  projectName: string
  cloned: ClonedGenerator[]
  /**
   * Result of the post-clone rebundle. Clone always introduces at
   * least one local generator (the cloned one), so this is always
   * `type: 'bundled'` — but we keep the discriminated union for
   * symmetry with {@link installHeadless} (which can be `noop` for
   * remote-only projects).
   *
   * Building here confirms the cloned generator bundles before the
   * command reports success. (`generate` rebuilds the bundle on every
   * run, so this bundle is not what it runs.)
   */
  bundle: BundleHeadlessResult
}

export const cloneHeadless = async ({
  skmtcRoot,
  projectName,
  generators,
  force
}: CloneHeadlessArgs): Promise<CloneHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)

  const cloned: ClonedGenerator[] = []
  for (const moduleName of generators) {
    const result = await project.cloneGenerator({ moduleName, projectName, force })
    cloned.push(result)
  }

  // Confirm the cloned generator bundles, and refuse a clone that puts
  // two copies of `@skmtc/core` in the graph.
  const bundle = await bundleHeadless({ skmtcRoot, projectName })

  return {
    projectName,
    cloned,
    bundle
  }
}
