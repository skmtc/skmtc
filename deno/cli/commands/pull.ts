import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { pullHeadless, type PullHeadlessResult } from '@/lib/pull-headless.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'

export const description =
  'Pull this project\'s config (enrichments + filters) from its skmtc-hub project into the local client.json. The destination is the `project: "@account/slug"` field in client.json (or --project). Replaces the local enrichments/include/skip; preserves local basePath/packages/source. The project must already exist on the hub.'

type RenderPullArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  token: string | undefined
  origin: string | undefined
  /** `--project` destination override (`@account/slug`). */
  project: string | undefined
  force?: boolean
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const USAGE = 'skmtc pull <project> [--project @account/slug]'
const EXAMPLE = 'skmtc pull my-api'

export const renderPull = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  origin,
  project: projectFlag,
  force,
  jsonFlag,
  noInputFlag
}: RenderPullArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    return failWithRecipe({
      command: 'pull',
      arg: '<project>',
      usage: USAGE,
      example: EXAMPLE,
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({
    tokenFlag: token,
    originFlag: origin
  })

  if (!resolvedToken) {
    return failWithRecipe({
      command: 'pull',
      arg: '--token',
      usage: USAGE,
      example: EXAMPLE,
      discover:
        'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. Mint a PAT at https://skmtc.dev/settings/tokens.'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  // Interactive overwrite gate: confirm before rewriting the local client.json.
  // Only fires when the pull actually changes the file (the headless path skips
  // the prompt on a no-op). In strict/agent mode there's no prompt; `--force`
  // skips it in a TTY too.
  const confirmOverwrite =
    mode === 'interactive' && !force
      ? ({
          account,
          slug,
          enrichmentGenerators
        }: {
          account: string
          slug: string
          enrichmentGenerators: number
        }) =>
          Promise.resolve(
            confirm(
              `Overwrite local config for "${projectName}" with ${account}/${slug} ` +
                `(${enrichmentGenerators} generator${
                  enrichmentGenerators === 1 ? '' : 's'
                } with enrichments)?`
            )
          )
      : undefined

  const result = await pullHeadless({
    skmtcRoot,
    projectName,
    token: resolvedToken,
    origin: resolvedOrigin,
    projectFlag,
    confirmOverwrite
  })

  printPullResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

type PrintPullResultOptions = {
  format: 'text' | 'json'
}

export const printPullResult = (
  result: PullHeadlessResult,
  { format }: PrintPullResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      switch (result.type) {
        case 'pulled': {
          if (!result.changed) {
            console.log(
              `Already up to date — "${result.projectName}" matches ${result.project.account}/${result.project.slug}.`
            )
            return
          }
          console.log(
            `Pulled ${result.project.account}/${result.project.slug} → "${result.projectName}"`
          )
          console.log(`  origin: ${result.origin}`)
          console.log(
            `  enrichments: ${result.enrichmentGenerators} generator${
              result.enrichmentGenerators === 1 ? '' : 's'
            }`
          )
          console.log(`  wrote: ${result.wrote}`)
          if (result.remoteWritten) {
            console.log('  note: recorded destination in client.json#project')
          }
          return
        }
        case 'aborted': {
          console.log(`Pull aborted — local "${result.projectName}" left unchanged.`)
          return
        }
        case 'failed': {
          console.error(`Pull failed for "${result.projectName}" at ${result.stage}:`)
          console.error(`  ${result.reason}`)
          return
        }
        default: {
          const _exhaustive: never = result
          throw new Error(`Unhandled pull result: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
