import { Command } from '@cliffy/command'
import { Input, Confirm } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from '@sentry/deno'
import chokidar from 'chokidar'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import { WsClient } from '../lib/ws-client.ts'
import { Workspace } from '../lib/workspace.ts'

export const description = 'Upload an OpenAPI schema to API Foundry'

export const toUploadCommand = () => {
  return new Command()
    .description(description)
    .arguments('<path:string>')
    .option('-w, --watch', 'Watch for changes and upload automatically')
    .action(async ({ watch }, path) => {
      if (watch) {
        watchUpload({ path })
      } else {
        await upload({ path })
      }
    })
}

export const toUploadPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  const watch = await Confirm.prompt({
    message: 'Watch for changes and upload automatically?'
  })

  if (watch) {
    watchUpload({ path })
  } else {
    await upload({ path })
  }
}

type UploadArgs = {
  path: string
}

type UploadOptions = {
  logSuccess?: string
}

export const watchUpload = ({ path }: UploadArgs) => {
  const watcher = chokidar.watch(path)

  watcher.on('change', () => upload({ path }, { logSuccess: 'Schema uploaded' }))
}

export const upload = async ({ path }: UploadArgs, { logSuccess }: UploadOptions = {}) => {
  const kv = await Deno.openKv()
  const kvState = new KvState(kv)

  const manager = new Manager({ kv, logSuccess })

  try {
    const apiClient = new ApiClient(manager)

    const workspace = new Workspace()

    const { id } = await workspace.getWorkspace({ kvState, apiClient })

    const wsClient = new WsClient({ workspaceId: id })

    wsClient.connect()

    const openApiSchema = await OpenApiSchema.open(path)

    const schema = await openApiSchema.upload({ apiClient, kvState })

    await wsClient.send({
      type: 'update-schema',
      payload: {
        v3JsonFilePath: schema.v3JsonFilePath
      }
    })

    wsClient.disconnect()

    await manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to upload schema')
  }
}
