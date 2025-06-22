import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import * as Sentry from 'npm:@sentry/deno'
import { KvState } from '../lib/kv-state.ts'

export const description = 'Get workspace info'

export const toWorkspacesGetCommand = () => {
  return new Command().description(description).action(async _args => {
    await get({ logSuccess: 'Workspace retrieved' })
  })
}

export const toWorkspacesGetPrompt = async () => {
  await get()
}

type GetOptions = {
  logSuccess?: string
}

export const get = async ({ logSuccess }: GetOptions = {}) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv, logSuccess })
  const kvState = new KvState(kv)

  try {
    const apiClient = new ApiClient(manager)

    const workspaceId = await kvState.getWorkspaceId()

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const workspace = await apiClient.getWorkspaceById(workspaceId)

    console.log(`${workspace.name} (${workspace.id})`)
  } catch (error) {
    Sentry.captureException(error)

    manager.fail('Failed to get workspace')
  }
}
