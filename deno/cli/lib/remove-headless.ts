/**
 * Headless `remove` path — drops a generator from a project's
 * `deno.json` and `client.json` without any Ink rendering. Strict
 * mode invokes this directly.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

type RemoveHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generator: string
}

export type RemoveHeadlessResult = {
  projectName: string
  removed: string
}

export const removeHeadless = async ({
  skmtcRoot,
  projectName,
  generator
}: RemoveHeadlessArgs): Promise<RemoveHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)
  const moduleName = generator.startsWith('jsr:') ? generator : `jsr:${generator}`
  await project.removeGenerator({ moduleName })

  return {
    projectName,
    removed: generator
  }
}
