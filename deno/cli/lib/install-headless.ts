/**
 * Headless install path — the data-mutation part of `skmtc install`
 * without any Ink rendering. Strict mode invokes this directly; the
 * interactive Ink view delegates to it after collecting any missing
 * arguments via prompts.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { bundleHeadless, type BundleHeadlessResult } from '@/lib/bundle-headless.ts'

type InstallHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
}

export type InstallHeadlessResult = {
  projectName: string
  installed: string[]
  /**
   * Result of the post-install rebundle. Will be `kind: 'noop'`
   * (reason `remote-only`) when the project still has no local
   * generators after the install — installed JSR generators run
   * their published `bundle.js` so no local bundle is needed.
   * `kind: 'bundled'` only when the project already has a cloned
   * or hand-authored generator that needed picking up the new
   * cross-generator import.
   *
   * Surfacing the bundle here is the install-side counterpart to
   * the same fix in `cloneHeadless`: post-mutation state is now
   * confirmed in the same command rather than left for the user
   * to discover via a separate `bundle` invocation.
   */
  bundle: BundleHeadlessResult
}

export const installHeadless = async ({
  skmtcRoot,
  projectName,
  generators
}: InstallHeadlessArgs): Promise<InstallHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)

  for (const generator of generators) {
    const moduleName = generator.startsWith('jsr:') ? generator : `jsr:${generator}`
    await project.installGenerator({ moduleName })
  }

  const bundle = await bundleHeadless({ skmtcRoot, projectName })

  return {
    projectName,
    installed: generators,
    bundle
  }
}
