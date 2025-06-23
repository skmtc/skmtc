import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import * as Sentry from 'npm:@sentry/deno'
import { KvState } from '../lib/kv-state.ts'

export const description = 'Get workspace info'

export const toWorkspacesInfoCommand = () => {
  return new Command().description(description).action(async _args => {
    await info({ logSuccess: 'Workspace retrieved' })
  })
}

export const toWorkspacesInfoPrompt = async () => {
  await info()
}

type InfoOptions = {
  logSuccess?: string
}

export const info = async ({ logSuccess }: InfoOptions = {}) => {
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

    await Sentry.flush()

    manager.fail('Failed to get workspace')
  }
}
