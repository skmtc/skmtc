import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { statusHeadless, type StatusHeadlessResult } from '@/lib/status-headless.ts'

type RenderStatusArgs = {
  projectName: string | undefined
  jsonFlag?: boolean
  checkFlag?: boolean
  verboseFlag?: boolean
  // Optional dependency for testing.
  skmtcRoot?: SkmtcRoot
}

/**
 * `status` is read-only: it classifies every generated file the
 * project's manifest records against the generated lock (clean /
 * modified / missing / unverified, plus orphaned files spared from
 * pruning) without touching anything. Like `clean` and `doctor` it
 * has no Ink variant — headless text or `--json` only. `--check`
 * turns a dirty status (modified or orphaned files) into exit 1 for
 * CI gates.
 */
export const renderStatus = async ({
  projectName,
  jsonFlag,
  checkFlag,
  verboseFlag,
  skmtcRoot: providedSkmtcRoot
}: RenderStatusArgs) => {
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'status',
      arg: '<project>',
      usage: 'skmtc status <project>',
      example: 'skmtc status my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  if (project === undefined) {
    return failWithRecipe({
      command: 'status',
      arg: '<project>',
      usage: 'skmtc status <project>',
      example: 'skmtc status my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const result = await statusHeadless({
    projectName,
    clientSettings: project.clientJson.contents?.settings
  })

  printStatusResult(result, {
    format: resolveOutputFormat({ jsonFlag }),
    verbose: verboseFlag ?? false
  })

  await skmtcRoot.manager.cleanup()

  Deno.exit(checkFlag && !result.clean ? 1 : 0)
}

type PrintStatusResultOptions = {
  format: 'text' | 'json'
  verbose: boolean
}

export const printStatusResult = (
  result: StatusHeadlessResult,
  { format, verbose }: PrintStatusResultOptions
): void => {
  switch (format) {
    case 'json': {
      // JSON always carries the full lists; `--verbose` only affects text.
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      if (result.noManifest) {
        console.log(
          `No status for "${result.projectName}" — no manifest found ` +
            `(project has not been generated, or the manifest is unreadable).`
        )
        return
      }

      const { counts } = result

      console.log(
        `${result.files.length} generated file(s) in "${result.projectName}": ` +
          `${counts.clean} clean, ${counts.modified} modified, ` +
          `${counts.missing} missing, ${counts.unverified} unverified.`
      )

      const listed = result.files.filter(({ status }) =>
        verbose ? true : status === 'modified'
      )

      for (const { path, status } of listed) {
        console.log(`  ${toStatusGlyph(status)} ${path}`)
      }

      if (counts.modified > 0) {
        console.log(
          `\nModified files carry manual edits — \`generate\` will leave them untouched. ` +
            `Move lasting changes into enrichments or hand-written modules, or revert to resume generation.`
        )
      }

      if (result.orphaned.length > 0) {
        console.log(
          `\n${result.orphaned.length} orphaned file(s) — edited, and no longer produced by any generator:`
        )
        for (const path of result.orphaned) {
          console.log(`  ! ${path}`)
        }
      }

      if (counts.unverified > 0) {
        console.log(
          `\nUnverified files predate edit detection — run \`skmtc generate\` once to seed the lock.`
        )
      }

      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

const toStatusGlyph = (status: 'clean' | 'modified' | 'missing' | 'unverified'): string => {
  switch (status) {
    case 'clean':
      return '✓'
    case 'modified':
      return 'M'
    case 'missing':
      return '?'
    case 'unverified':
      return '~'
    default: {
      const _exhaustive: never = status
      throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
