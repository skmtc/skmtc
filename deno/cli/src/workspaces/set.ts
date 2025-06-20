import { Command } from '@cliffy/command'
import { Select } from '@cliffy/prompt'
import { toRootPath } from '../lib/to-root-path.ts'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'

export const description = 'Set workspace id'

export const toWorkspacesSetCommand = () => {
  return new Command()
    .description(description)
    .arguments('<workspace-id:string>')

    .action(async (_, workspaceId) => {
      const kv = await Deno.openKv()

      await setWorkspaceId({ workspaceId, kv })
    })
}

export const toWorkspacesSetPrompt = async () => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  const apiClient = new ApiClient(manager)

  const workspaces: { label: string; id: string }[] = await apiClient.getWorkspaces()

  const workspaceId: string = await Select.prompt({
    message: 'Select a workspace',
    options: workspaces.map(({ label, id }) => ({ name: label, value: id }))
  })

  await setWorkspaceId({ workspaceId, kv })
}

type SetWorkspaceIdArgs = {
  workspaceId: string
  kv: Deno.Kv
}

type SetWorkspaceIdOptions = {
  logSuccess?: string
}

const setWorkspaceId = async ({ workspaceId, kv }: SetWorkspaceIdArgs) => {
  const rootPath = toRootPath()

  await kv.set([rootPath, 'workspaceId'], workspaceId)

  return workspaceId
}
