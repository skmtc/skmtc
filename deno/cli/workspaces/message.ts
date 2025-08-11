import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import { Input } from '@cliffy/prompt'
import { WsClient } from '../lib/ws-client.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const description = 'Send message to project'

export const toWorkspacesMessageCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <content:string>')
    .action(async (_, project, content) => {
      await message({ projectName: project, skmtcRoot, content }, { logSuccess: 'Message sent' })
    })
}

export const toWorkspacesMessagePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const content = await Input.prompt({
    message: 'Enter the message to send'
  })

  await message({ projectName, skmtcRoot, content })
}

type MessageOptions = {
  logSuccess?: string
}

type MessageArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  content: string
}

export const message = async (
  { projectName, skmtcRoot, content }: MessageArgs,
  { logSuccess }: MessageOptions = {}
) => {
  try {
    const workspace = new Workspace()

    const { id } = await workspace.getWorkspace({ projectName, skmtcRoot })

    const wsClient = new WsClient({ workspaceId: id })

    wsClient.connect()

    await wsClient.send({
      type: 'basic-message',
      payload: {
        content
      }
    })

    wsClient.disconnect()

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to get workspace')
  }
}
