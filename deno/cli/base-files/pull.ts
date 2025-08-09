import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'
import type { Controller } from '../lib/types.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const description = 'Pull base files from deployed workspace'

export const toBaseFilesPullCommand = () => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .action(async (_args, project, path) => {
      return await pull({ projectName: project, path })
    })
}

export const toBaseFilesPullPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to deploy generators to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const path = await Input.prompt({
    message: 'Enter destination path for base files'
  })

  await pull({ projectName, path })
}

type PullArgs = {
  projectName: string
  path: string
}

export const pull = async ({ projectName, path }: PullArgs) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  const apiClient = new ApiClient(manager)
  const kvState = new KvState(kv)

  try {
    const workspaceId = await kvState.getWorkspaceId(projectName)

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const workspace = await apiClient.getWorkspaceById(workspaceId)

    console.log('WORKSPACE', workspace)
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to pull base files')
  }
}

export const baseFilesPullController: Controller = {
  action: 'base-files:pull',
  description: 'Pull base files from deployed workspace',
  toCommand: toBaseFilesPullCommand,
  toPrompt: toBaseFilesPullPrompt,
  filter: ({ hasHome, hasGenerators }) => true
}
