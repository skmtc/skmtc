import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'
import type { Controller } from '../lib/types.ts'

export const description = 'Pull base image from deployed workspace'

export const toBaseImagePullCommand = (): Command<any, any, any, any, any, any, any, any> => {
  return new Command()
    .description(description)
    .arguments('<path:string>')
    .action(async (_args, path) => {
      await pull({ path })
    })
}

export const toBaseImagePullPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter destination path for base image'
  })

  await pull({ path })
}

type PullArgs = {
  path: string
}

export const pull = async ({ path }: PullArgs) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  const apiClient = new ApiClient(manager)
  const kvState = new KvState(kv)

  try {
    const workspaceId = await kvState.getWorkspaceId()

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const workspace = await apiClient.getWorkspaceById(workspaceId)

    console.log('WORKSPACE', workspace)
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to pull base image')
  }
}

export const baseImagePullController: Controller = {
  action: 'base-image:pull',
  description: 'Pull base image from deployed workspace',
  toCommand: toBaseImagePullCommand,
  toPrompt: toBaseImagePullPrompt,
  filter: ({ hasHome, hasGenerators }) => true
}
