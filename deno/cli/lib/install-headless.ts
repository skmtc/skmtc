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
  /**
   * Override for the post-install rebundle — tests stub this to keep
   * the install assertions free of the `deno bundle` subprocess.
   */
  bundleFn?: typeof bundleHeadless
}

export type InstallHeadlessResult = {
  projectName: string
  installed: string[]
  /**
   * Result of the post-install rebundle. Always `type: 'bundled'`.
   * Building here confirms the new generator bundles before the
   * command reports success — the install-side counterpart to
   * `cloneHeadless`. (`generate` rebuilds the bundle on every run.)
   */
  bundle: BundleHeadlessResult
}

export const installHeadless = async ({
  skmtcRoot,
  projectName,
  generators,
  bundleFn = bundleHeadless
}: InstallHeadlessArgs): Promise<InstallHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)

  for (const generator of generators) {
    const moduleName = generator.startsWith('jsr:') ? generator : `jsr:${generator}`
    await project.installGenerator({ moduleName })
  }

  const bundle = await bundleFn({ skmtcRoot, projectName })

  return {
    projectName,
    installed: generators,
    bundle
  }
}
