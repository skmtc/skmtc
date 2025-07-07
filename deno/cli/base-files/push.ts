import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'
import { BaseFiles } from '../lib/base-files.ts'
import { Workspace } from '../lib/workspace.ts'

export const toDescription = async (): Promise<string> => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })
  const kvState = new KvState(kv)

  try {
    const apiClient = new ApiClient(manager)

    const workspace = new Workspace()

    const accountName = await apiClient.manager.auth.toUserName()

    const { name } = await workspace.getWorkspace({ kvState, apiClient })

    await manager.success()

    return `Push base files to @${accountName}/${name}`
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to get workspace')

    Deno.exit(1)
  }
}

export const toBaseFilesPushCommand = async () => {
  const description = await toDescription()

  return new Command()
    .description(description)
    .arguments('<path:string>')
    .action(async (_args, path) => {
      await push({ path })
    })
}

export const toBaseFilesPushPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to base files folder'
  })

  await push({ path })
}

type PushArgs = {
  path: string
}

export const push = async ({ path }: PushArgs) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  try {
    const kvState = new KvState(kv)
    const workspaceId = await kvState.getWorkspaceId()

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const apiClient = new ApiClient(manager)
    const baseFiles = new BaseFiles(path)

    await baseFiles.push({ kvState, apiClient })
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to push base files')
  }
}
