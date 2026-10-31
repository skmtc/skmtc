import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import {
  deployHeadless,
  type DeployHeadlessResult,
  toDeployedLines,
  toDeployExitCode
} from '@/lib/deploy-headless.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'
import { type HubEnv, toMissingTokenHint } from '@/lib/hub-env.ts'

export const description =
  'Store a new immutable version of this project on skmtc-hub and deploy it. Versions are addressed by semver; an existing version is refused unless --existing deploys it as it is.'

/** The one line `skmtc publish` prints to stderr before it runs `deploy`. */
export const PUBLISH_ALIAS_NOTICE = '`skmtc publish` is now `skmtc deploy`'

type RenderDeployArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  token: string | undefined
  env: HubEnv | undefined
  version: string | undefined
  existing?: boolean
  jsonFlag?: boolean
  noInputFlag?: boolean
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

const USAGE = 'skmtc deploy <project> --token <pat> [--version <semver>] [--existing]'
const EXAMPLE = 'skmtc deploy my-api --token $SKMTC_HUB_TOKEN'

export const renderDeploy = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  token,
  env,
  version,
  existing,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderDeployArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    return failWithRecipe({
      command: 'deploy',
      arg: '<project>',
      usage: USAGE,
      example: EXAMPLE,
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (mode === 'strict') {
    const {
      token: resolvedToken,
      origin: resolvedOrigin,
      env: resolvedEnv
    } = await resolveHubAuth({
      tokenFlag: token,
      envFlag: env
    })

    if (!resolvedToken) {
      return failWithRecipe({
        command: 'deploy',
        arg: '--token',
        usage: USAGE,
        example: EXAMPLE,
        discover: toMissingTokenHint(resolvedEnv)
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = await deployHeadless({
      skmtcRoot,
      projectName,
      token: resolvedToken,
      origin: resolvedOrigin,
      version,
      envFlag: env,
      existing
    })
    printDeployResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(toDeployExitCode(result))
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  // Thread the CLI args through to the Ink view so the DeployView
  // can run `deployHeadless` without re-resolving env vars.
  const initialState: SkmtcState = {
    view: {
      page: 'deploy',
      projectName,
      token,
      env,
      version,
      existing
    },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

/**
 * `skmtc publish`, the old name of `deploy`: the notice on stderr, so
 * `--json` stdout stays one document, then the same code as `deploy`.
 */
export const renderPublishAlias = async (args: RenderDeployArgs) => {
  console.error(PUBLISH_ALIAS_NOTICE)
  await renderDeploy(args)
}

type PrintDeployResultOptions = {
  format: 'text' | 'json'
}

export const printDeployResult = (
  result: DeployHeadlessResult,
  { format }: PrintDeployResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      switch (result.type) {
        case 'deployed': {
          for (const line of toDeployedLines(result)) console.log(line)
          return
        }
        case 'failed': {
          console.error(`Deploy failed for "${result.projectName}" at ${result.stage}:`)
          console.error(`  ${result.reason}`)
          return
        }
        default: {
          const _exhaustive: never = result
          throw new Error(`Unhandled deploy result: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
