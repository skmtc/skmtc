/**
 * Headless `list` path — returns the project's generator inventory
 * without any Ink rendering. Strict mode invokes this directly; the
 * interactive Ink view also reads through the same data layer so the
 * two surfaces stay in sync.
 *
 * Returning a structured result (rather than printing directly) is
 * deliberate: the same value is fed to the human-readable formatter
 * AND to the `--json` formatter, and the test suite asserts against
 * it without parsing stdout.
 */

import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

type ListHeadlessArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
}

export type ListHeadlessResult = {
  projectName: string
  generators: string[]
}

export const listHeadless = ({ skmtcRoot, projectName }: ListHeadlessArgs): ListHeadlessResult => {
  const project = skmtcRoot.findProject(projectName)
  return {
    projectName,
    generators: project.toGeneratorIds()
  }
}
