/**
 * Headless install path — the data-mutation part of `skmtc install`
 * without any Ink rendering. Strict mode invokes this directly; the
 * interactive Ink view delegates to it after collecting any missing
 * arguments via prompts.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

type InstallHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
}

export type InstallHeadlessResult = {
  projectName: string
  installed: string[]
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

  return {
    projectName,
    installed: generators
  }
}
