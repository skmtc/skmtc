import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { deployHeadless, type DeployHeadlessResult } from '@/lib/deploy-headless.ts'

export const description = 'Build the CF-Workers server.js bundle and upload it to skmtc-hub as a release.'

type RenderDeployArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  stack: string | undefined
  version: string | undefined
  token: string | undefined
  hubUrl: string | undefined
  notes: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderDeploy = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  stack,
  version,
  token,
  hubUrl,
  notes,
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
      usage: 'skmtc deploy <project> --stack <account/slug> --version <semver> --token <pat>',
      example: 'skmtc deploy my-api --stack me/petstore --version 0.0.1 --token $SKMTC_HUB_TOKEN',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (mode === 'strict') {
    const resolvedStack = stack ?? Deno.env.get('SKMTC_HUB_STACK')
    const resolvedVersion = version
    const resolvedToken = token ?? Deno.env.get('SKMTC_HUB_TOKEN')
    const resolvedHubUrl = hubUrl ?? Deno.env.get('SKMTC_HUB_URL')

    if (!resolvedStack) {
      return failWithRecipe({
        command: 'deploy',
        arg: '--stack',
        usage: 'skmtc deploy <project> --stack <account/slug> --version <semver> --token <pat>',
        example: 'skmtc deploy my-api --stack me/petstore --version 0.0.1 --token $SKMTC_HUB_TOKEN',
        discover: 'Set $SKMTC_HUB_STACK or pass --stack <account/slug>.'
      })
    }
    if (!resolvedVersion) {
      return failWithRecipe({
        command: 'deploy',
        arg: '--version',
        usage: 'skmtc deploy <project> --stack <account/slug> --version <semver> --token <pat>',
        example: 'skmtc deploy my-api --stack me/petstore --version 0.0.1 --token $SKMTC_HUB_TOKEN',
        discover: 'Pass --version <semver>; releases are immutable per (stack, version).'
      })
    }
    if (!resolvedToken) {
      return failWithRecipe({
        command: 'deploy',
        arg: '--token',
        usage: 'skmtc deploy <project> --stack <account/slug> --version <semver> --token <pat>',
        example: 'skmtc deploy my-api --stack me/petstore --version 0.0.1 --token $SKMTC_HUB_TOKEN',
        discover: 'Set $SKMTC_HUB_TOKEN or pass --token. Mint a PAT via POST /v1/user/tokens.'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = await deployHeadless({
      skmtcRoot,
      projectName,
      stack: resolvedStack,
      version: resolvedVersion,
      token: resolvedToken,
      hubUrl: resolvedHubUrl,
      notes
    })
    printDeployResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(result.kind === 'deployed' ? 0 : 1)
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const session = await skmtcRoot.manager.auth.toSession()

  // Thread the CLI args through to the Ink view so the DeployView
  // can run `deployHeadless` without re-resolving env vars.
  const initialState: SkmtcState = {
    view: {
      page: 'deploy',
      projectName,
      stack,
      version,
      token,
      hubUrl,
      notes
    },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
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
      switch (result.kind) {
        case 'deployed': {
          console.log(`Deployed "${result.projectName}" → ${result.stack.account}/${result.stack.slug}@${result.version}`)
          console.log(`  bundle: ${result.bundlePath}`)
          console.log(`  bytes: ${result.bundleBytes}`)
          console.log(`  sha256: ${result.bundleSha256}`)
          console.log(`  release: ${result.releaseUrl}`)
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
