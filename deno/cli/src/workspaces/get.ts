import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import { toRootPath } from '../lib/to-root-path.ts'
import * as Sentry from 'npm:@sentry/deno'

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

  try {
    const apiClient = new ApiClient(manager)

    const workspaceId = await getWorkspaceId({ kv })

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

type GetWorkspaceId = {
  kv: Deno.Kv
}

export const getWorkspaceId = async ({ kv }: GetWorkspaceId) => {
  const rootPath = toRootPath()

  const workspaceId = await kv.get([rootPath, 'workspaceId'])

  return workspaceId.value
}
