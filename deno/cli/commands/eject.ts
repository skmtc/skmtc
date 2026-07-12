import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { ejectHeadless, adoptHeadless } from '@/lib/eject-headless.ts'
import type { EjectHeadlessResult, AdoptHeadlessResult } from '@/lib/eject-headless.ts'

type RenderEjectArgs = {
  projectName: string | undefined
  file: string | undefined
  jsonFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `eject` moves a generated file to user ownership: renames
 * `X.generated.ts` → `X.ts`, records it in
 * `client.json#settings.ejected` + `.settings/ejections.json`, and
 * from the next generate on the engine references the owned path
 * (peer imports follow automatically) while the CLI never writes or
 * deletes the file. `adopt` is the symmetric inverse. Both are
 * headless-only (text or `--json`), like `clean` and `status`.
 */
export const renderEject = async ({
  projectName,
  file,
  jsonFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderEjectArgs) => {
  if (projectName === undefined || file === undefined) {
    return failWithRecipe({
      command: 'eject',
      arg: projectName === undefined ? '<project>' : '<file>',
      usage: 'skmtc eject <project> <file>',
      example: 'skmtc eject my-api src/types/user.generated.ts',
      discover: 'skmtc status <project>  (list generated files)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'eject',
      arg: '<project>',
      usage: 'skmtc eject <project> <file>',
      example: 'skmtc eject my-api src/types/user.generated.ts',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = await ejectHeadless({
    projectName,
    file,
    clientSettings: project.clientJson.contents?.settings
  })

  printEjectResult(result, resolveOutputFormat({ jsonFlag }))

  // ejectHeadless wrote settings.ejected to client.json directly; the
  // manager's cleanup below write-backs the project's IN-MEMORY copy,
  // which predates that write and would silently clobber it. Refresh
  // from disk first.
  await project.clientJson.refresh()

  await skmtcRoot.manager.cleanup()

  Deno.exit(result.ok ? 0 : 1)
}

export const printEjectResult = (result: EjectHeadlessResult, format: 'text' | 'json'): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      if (!result.ok) {
        console.log(`Eject failed: ${result.reason}`)
        return
      }

      console.log(
        `Ejected "${result.previousArtifactPath}" → "${result.ownedArtifactPath}".\n` +
          `The file is yours now: generators stop writing it, peer imports follow the new ` +
          `path on the next generate, and it will never be overwritten or deleted.`
      )

      if (result.items.length > 0) {
        console.log(`\nThis file was produced by ${result.items.length} generator item(s):`)
        for (const item of result.items) {
          console.log(`  ${item.generator} · ${item.schemaPointer} · ${item.variant}`)
        }
      }

      if (!result.baselineRecorded) {
        console.log(
          `\nNote: no canonical baseline was available to record — drift detection for this ` +
            `file starts from the next generate.`
        )
      }

      console.log(`\nRun \`skmtc generate\` to update peer imports. Reverse with \`skmtc adopt\`.`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

type RenderAdoptArgs = {
  projectName: string | undefined
  file: string | undefined
  jsonFlag?: boolean
  skmtcRoot?: SkmtcRoot
}

export const renderAdopt = async ({
  projectName,
  file,
  jsonFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderAdoptArgs) => {
  if (projectName === undefined || file === undefined) {
    return failWithRecipe({
      command: 'adopt',
      arg: projectName === undefined ? '<project>' : '<file>',
      usage: 'skmtc adopt <project> <file>',
      example: 'skmtc adopt my-api src/types/user.ts',
      discover: 'skmtc status <project>  (ejected files are marked E)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'adopt',
      arg: '<project>',
      usage: 'skmtc adopt <project> <file>',
      example: 'skmtc adopt my-api src/types/user.ts',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = adoptHeadless({
    projectName,
    file,
    clientSettings: project.clientJson.contents?.settings
  })

  printAdoptResult(result, resolveOutputFormat({ jsonFlag }))

  // Same write-back hazard as renderEject: adoptHeadless updated
  // client.json on disk; refresh the in-memory copy before the
  // manager's cleanup writes it back.
  await project.clientJson.refresh()

  await skmtcRoot.manager.cleanup()

  Deno.exit(result.ok ? 0 : 1)
}

export const printAdoptResult = (result: AdoptHeadlessResult, format: 'text' | 'json'): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      if (!result.ok) {
        console.log(`Adopt failed: ${result.reason}`)
        return
      }

      console.log(
        `Adopted "${result.ownedExportPath}" back into generation as ` +
          `"${result.generatedArtifactPath}".\n` +
          `The next generate resumes writing it — and if the file still carries manual ` +
          `edits, it will be protected, not overwritten.`
      )
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
