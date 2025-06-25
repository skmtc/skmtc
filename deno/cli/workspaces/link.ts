import { Command } from '@cliffy/command'
import { Select } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import * as Sentry from '@sentry/deno'

export const description = 'Link local workplace to remote'

export const toWorkspacesLinkCommand = () => {
  return new Command()
    .description(description)
    .arguments('<workspace-id:string>')

    .action(async (_, workspaceId) => {
      await link({ workspaceId })
    })
}

type LinkArgs = {
  workspaceId: string
}

export const toWorkspacesLinkPrompt = async () => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  const apiClient = new ApiClient(manager)

  const workspaces: { label: string; id: string }[] = await apiClient.getWorkspaces()

  const workspaceId: string = await Select.prompt({
    message: 'Select a workspace',
    options: workspaces.map(({ label, id }) => ({ name: label, value: id }))
  })

  await link({ workspaceId })
}

export const link = async ({ workspaceId }: LinkArgs) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  try {
    const kvState = new KvState(kv)

    await kvState.setWorkspaceId(workspaceId)

    await manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to set workspace id')
  }
}
