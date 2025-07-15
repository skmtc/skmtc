import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import * as Sentry from '@sentry/deno'
import { KvState } from '../lib/kv-state.ts'
import { Workspace } from '../lib/workspace.ts'
import { Input } from '@cliffy/prompt'
import { WsClient } from '../lib/ws-client.ts'

export const description = 'Send a message to a workspace'

export const toWorkspacesMessageCommand = () => {
  return new Command()
    .description(description)
    .arguments('<content:string>')
    .action(async (_, content) => {
      await message({ content }, { logSuccess: 'Message sent' })
    })
}

export const toWorkspacesMessagePrompt = async () => {
  const content = await Input.prompt({
    message: 'Enter the message to send'
  })

  await message({ content })
}

type MessageOptions = {
  logSuccess?: string
}

type MessageArgs = {
  content: string
}

export const message = async ({ content }: MessageArgs, { logSuccess }: MessageOptions = {}) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv, logSuccess })
  const kvState = new KvState(kv)

  try {
    const apiClient = new ApiClient(manager)

    const workspace = new Workspace()

    const { id } = await workspace.getWorkspace({ kvState, apiClient })

    const wsClient = new WsClient({ workspaceId: id })

    wsClient.connect()

    await wsClient.send({
      type: 'basic-message',
      payload: {
        content
      }
    })

    wsClient.disconnect()

    await manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to get workspace')
  }
}
