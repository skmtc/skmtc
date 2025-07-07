import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import * as Sentry from '@sentry/deno'
import { KvState } from '../lib/kv-state.ts'
import { Workspace } from '../lib/workspace.ts'

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

    const workspace = new Workspace()

    const { name, id } = await workspace.getWorkspace({ kvState, apiClient })

    console.log(`${name} (${id})`)

    await manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to get workspace')
  }
}
