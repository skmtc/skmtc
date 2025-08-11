import { Command } from '@cliffy/command'
import { Input, Confirm } from '@cliffy/prompt'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from '@sentry/deno'
import chokidar from 'chokidar'
import { WsClient } from '../lib/ws-client.ts'
import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const description = 'Upload an OpenAPI schema to API Foundry'

export const toUploadCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .option('-w, --watch', 'Watch for changes and upload automatically')
    .action(async ({ watch }, project, path) => {
      if (watch) {
        watchUpload({ projectName: project, skmtcRoot, path })
      } else {
        await upload({ projectName: project, skmtcRoot, path })
      }
    })
}

export const toUploadPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to upload schema to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  const watch = await Confirm.prompt({
    message: 'Watch for changes and upload automatically?'
  })

  if (watch) {
    watchUpload({ projectName, skmtcRoot, path })
  } else {
    await upload({ projectName, skmtcRoot, path })
  }
}

type UploadArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  path: string
}

type UploadOptions = {
  logSuccess?: string
}

export const watchUpload = ({ projectName, skmtcRoot, path }: UploadArgs) => {
  const watcher = chokidar.watch(path)

  watcher.on('change', () =>
    upload({ projectName, skmtcRoot, path }, { logSuccess: 'Schema uploaded' })
  )
}

export const upload = async (
  { projectName, skmtcRoot, path }: UploadArgs,
  { logSuccess }: UploadOptions = {}
) => {
  try {
    const workspace = new Workspace()

    const { id } = await workspace.getWorkspace({ projectName, skmtcRoot })

    const wsClient = new WsClient({ workspaceId: id })

    wsClient.connect()

    const openApiSchema = await OpenApiSchema.open(path)

    const schema = await openApiSchema.upload({ projectName, skmtcRoot })

    await wsClient.send({
      type: 'update-schema',
      payload: {
        v3JsonFilePath: schema.v3JsonFilePath
      }
    })

    wsClient.disconnect()

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to upload schema')
  }
}
