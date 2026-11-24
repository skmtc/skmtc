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

type ToCloneConflictTextArgs = {
  error: CoreConflictError
  projectName: string
  /** The generators the command or the picker asked to clone. */
  generators: string[]
}

/**
 * The text `clone` prints for a core conflict, in strict mode and in the
 * picker. A local generator (cloned or created) keeps the core its own
 * `deno.json` names, so when one is in the way the text says how to move
 * it. The command it suggests passes `--no-input`, because the picker lists
 * only published generators and cannot name a local one.
 */
export const toCloneConflictText = ({
  error,
  projectName,
  generators
}: ToCloneConflictTextArgs): string => {
  const local = error.requirements.flatMap(({ generatorId, localPath }) =>
    localPath === undefined ? [] : [generatorId]
  )

  const toCommand = (ids: string[]) =>
    `skmtc clone ${projectName} ${ids.map(id => `-g ${id}`).join(' ')} --force --no-input`

  const localLines =
    local.length === 0
      ? []
      : [
          `A local generator keeps the @skmtc/core its own deno.json names: ${local.join(', ')}.`,
          'Change that pin. Or, if it is a clone of a published generator, replace it with the published version (this deletes its folder and its edits):',
          `  ${toCommand([...generators, ...local.filter(id => !generators.includes(id))])}`
        ]

  return [
    error.message,
    '',
    ...localLines,
    'Pass --force to clone anyway: the project keeps its core pin, and the next bundle can fail.'
  ].join('\n')
}

type CloneHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
  /**
   * Replace each named generator that is already cloned: delete its folder
   * and clone the published version again. A `@skmtc/core` conflict then
   * warns instead of refusing, and the project keeps its core pin.
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
