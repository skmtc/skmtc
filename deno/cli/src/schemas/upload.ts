import { Command } from '@cliffy/command'
import { Input, Confirm } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { SchemaUpload } from '../lib/schema-upload.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from 'npm:@sentry/deno'
import chokidar from 'npm:chokidar'

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

  watcher.on('change', () => upload({ path }))
}

export const upload = async ({ path }: UploadArgs, { logSuccess }: UploadOptions = {}) => {
  const kv = await Deno.openKv()
  const manager = new Manager({ kv, logSuccess })

  try {
    const openApiSchema = await OpenApiSchema.open(path)

    const schemaUpload = new SchemaUpload(manager)

    const schema = await schemaUpload.upload(openApiSchema)

    console.log('Schema uploaded', JSON.stringify(schema, null, 2))
  } catch (error) {
    Sentry.captureException(error)

    manager.fail('Failed to upload schema')
  }
}
