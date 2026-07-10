import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { mergeHeadless, type MergeHeadlessResult } from '@/lib/merge-headless.ts'

type RenderMergeArgs = {
  projectName: string | undefined
  file: string | undefined
  jsonFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `merge` resolves drift on an ejected file: a three-way merge that
 * keeps the user's edits and applies the generator's changes, advancing
 * the baseline. Refuses whole on collisions — never writes conflict
 * markers. Headless-only (text or `--json`), like `eject` and `adopt`.
 */
export const renderMerge = async ({
  projectName,
  file,
  jsonFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderMergeArgs) => {
  if (projectName === undefined || file === undefined) {
    return failWithRecipe({
      command: 'merge',
      arg: projectName === undefined ? '<project>' : '<file>',
      usage: 'skmtc merge <project> <file>',
      example: 'skmtc merge my-api src/types/user.ts',
      discover: 'skmtc status <project>  (drifted ejected files are annotated)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'merge',
      arg: '<project>',
      usage: 'skmtc merge <project> <file>',
      example: 'skmtc merge my-api src/types/user.ts',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = mergeHeadless({
    projectName,
    file,
    clientSettings: project.clientJson.contents?.settings
  })

  printMergeResult(result, resolveOutputFormat({ jsonFlag }))

  await skmtcRoot.manager.cleanup()

  Deno.exit(result.ok ? 0 : 1)
}

export const printMergeResult = (result: MergeHeadlessResult, format: 'text' | 'json'): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      if (!result.ok) {
        console.log(`Merge failed: ${result.reason}`)
        if (result.collisions) {
          for (const { start, end } of result.collisions) {
            console.log(`  baseline lines ${start + 1}–${Math.max(end, start + 1)}`)
          }
        }
        return
      }

      if (result.upToDate) {
        console.log(
          `Nothing to merge — "${result.ownedArtifactPath}" is already up to date with its generator.`
        )
        return
      }

      console.log(
        `Merged the generator's changes into "${result.ownedArtifactPath}", keeping your edits.\n` +
          `The baseline advanced; the file stays ejected (return it to generation with \`skmtc adopt\`).`
      )
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
