/**
 * Headless `clone` path — the data-mutation part of `skmtc clone`
 * without any Ink rendering. Strict mode invokes this directly; the
 * Ink `CloneGeneratorView` collects the same args via a MultiSelect
 * picker and then takes an identical path through
 * `project.cloneGenerators()`.
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
import type { CoreConflictError } from '@/lib/stack-core.ts'

/**
 * The text `clone` prints for a core conflict. A local copy (cloned or
 * created) keeps the core its own `deno.json` names, so when one is in the
 * way the text says how to move it.
 */
export const toCloneConflictText = (error: CoreConflictError): string => {
  const localCopies = error.requirements.flatMap(({ generatorId, localPath }) =>
    localPath === undefined ? [] : [generatorId]
  )

  const localLines =
    localCopies.length === 0
      ? []
      : [
          `A local copy keeps the @skmtc/core its own deno.json names: ${localCopies.join(', ')}.`,
          'Change that pin, or name the copy in the same clone command to replace it with the published version (this overwrites its edits).'
        ]

  return [error.message, '', ...localLines, 'Pass --force to clone without this check.'].join('\n')
}

type CloneHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
  /**
   * Skip the `@skmtc/core` check (`cloneGenerators`), which refuses a
   * clone when no one core fits every generator in the project. The
   * project then keeps its core pin, and the bundle can load two cores.
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

  const cloned: ClonedGenerator[] = await project.cloneGenerators({ moduleNames: generators, force })

  // Confirm the cloned generator bundles, and refuse a clone that puts
  // two copies of `@skmtc/core` in the graph.
  const bundle = await bundleHeadless({ skmtcRoot, projectName })

  return {
    projectName,
    cloned,
    bundle
  }
}
