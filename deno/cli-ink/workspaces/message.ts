import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '../lib/workspace.ts'
import { Input } from '../components/index.ts'
import { WsClient } from '../lib/ws-client.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Project } from '../lib/project.ts'
import invariant from 'tiny-invariant'

export const description = 'Send message to project'

export const toWorkspacesMessageCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <content:string>')
    .action(async (_, projectName, content) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      await message({ project, skmtcRoot, content }, { logSuccess: 'Message sent' })
    })
}

export const toWorkspacesMessagePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  const content = await Input.prompt({
    message: 'Enter the message to send'
  })

  await message({ project, skmtcRoot, content })
}

type MessageOptions = {
  logSuccess?: string
}

type MessageArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  content: string
}

export const message = async (
  { project, skmtcRoot, content }: MessageArgs,
  { logSuccess }: MessageOptions = {}
) => {
  try {
    const workspace = new Workspace()

    const { id } = await workspace.getWorkspace({ project, skmtcRoot })

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

    await skmtcRoot.manager.fail('Failed to get workspace')
  }
}
