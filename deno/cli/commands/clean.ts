import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { cleanHeadless, type CleanHeadlessResult } from '@/lib/clean-headless.ts'

type RenderCleanArgs = {
  projectName: string | undefined
  jsonFlag?: boolean
  dryRunFlag?: boolean
  verboseFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `clean` is a destructive utility: it deletes every generated file a
 * project's manifest recorded, prunes the directories that held them,
 * then removes the manifest itself. Like `doctor` and `agent-context`
 * it has no Ink variant — it always runs headless and emits a text or
 * `--json` result. There is no prompt, so the `<project>` arg is
 * required up front (recipe error otherwise).
 */
export const renderClean = async ({
  projectName,
  jsonFlag,
  dryRunFlag,
  verboseFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderCleanArgs) => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'clean',
      arg: '<project>',
      usage: 'skmtc clean <project>',
      example: 'skmtc clean my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  // Resolve the root so the project name is validated against what
  // exists on disk — a typo'd project should fail loudly, not silently
  // clean nothing.
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'clean',
      arg: '<project>',
      usage: 'skmtc clean <project>',
      example: 'skmtc clean my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = await cleanHeadless({
    projectName,
    dryRun: dryRunFlag ?? false,
    clientSettings: project.clientJson.contents?.settings
  })

  printCleanResult(result, {
    format: resolveOutputFormat({ jsonFlag }),
    verbose: verboseFlag ?? false
  })

  await skmtcRoot.manager.cleanup()

  Deno.exit(0)
}

type PrintCleanResultOptions = {
  format: 'text' | 'json'
  verbose: boolean
}

export const printCleanResult = (
  result: CleanHeadlessResult,
  { format, verbose }: PrintCleanResultOptions
): void => {
  switch (format) {
    case 'json': {
      // JSON always carries the full lists; `--verbose` only affects text.
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      const verb = result.dryRun ? 'Would delete' : 'Deleted'

      if (result.noManifest) {
        console.log(
          `Nothing to clean for "${result.projectName}" — no manifest found ` +
            `(project has not been generated, or the manifest is unreadable).`
        )
        return
      }

      console.log(
        `${verb} ${result.deleted.length} generated file(s) for "${result.projectName}".`
      )

      if (verbose) {
        for (const path of result.deleted) {
          console.log(`  ${result.dryRun ? '-' : '✓'} ${path}`)
        }
      }

      if (result.removedDirs.length > 0) {
        const dirVerb = result.dryRun ? 'would remove' : 'removed'
        console.log(`  (${dirVerb} ${result.removedDirs.length} empty director(ies))`)
        if (verbose) {
          for (const dir of result.removedDirs) {
            console.log(`    ${dir}/`)
          }
        }
      }

      if (result.missing.length > 0) {
        console.log(`  (${result.missing.length} already absent)`)
      }

      if (result.skipped.length > 0) {
        console.log(
          `  (${result.skipped.length} refused — resolved outside the app root)`
        )
      }

      if (result.dryRun) {
        console.log(`\nDry run — nothing was deleted. Re-run without --dry-run to apply.`)
      } else if (result.manifestRemoved) {
        console.log(`Removed manifest.`)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
