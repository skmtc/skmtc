/**
 * Headless `clone` path — the data-mutation part of `skmtc clone`
 * without any Ink rendering. Strict mode invokes this directly; the
 * Ink `CloneGeneratorView` collects the same args via a MultiSelect
 * picker and then takes an identical path through
 * `project.cloneGenerator()`.
 *
 * Closes friction #25 (the Ink view was the only way to name the
 * generators to clone — no positional / flag form existed).
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Generator } from '@/lib/generator.ts'

type CloneHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generators: string[]
}

export type CloneHeadlessResult = {
  projectName: string
  cloned: string[]
}

export const cloneHeadless = async ({
  skmtcRoot,
  projectName,
  generators
}: CloneHeadlessArgs): Promise<CloneHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName)
  const generatorsDenoJson = await Generator.getGeneratorsRootDenoJson()

  for (const moduleName of generators) {
    await project.cloneGenerator({ moduleName, projectName, generatorsDenoJson })
  }

  return {
    projectName,
    cloned: generators
  }
}
