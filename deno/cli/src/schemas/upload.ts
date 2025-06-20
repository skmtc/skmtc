import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { SchemaUpload } from '../lib/schema-upload.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'

export const description = 'Upload an OpenAPI schema to API Foundry'

export const toUploadCommand = () => {
  return new Command()
    .description(description)
    .arguments('<path:string>')

    .action(async (_, path) => {
      await upload({ path })
    })
}

export const toUploadPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  await upload({ path }, { logSuccess: 'Schema uploaded' })
}

type UploadArgs = {
  path: string
}

type UploadOptions = {
  logSuccess?: string
}

export const upload = async ({ path }: UploadArgs, { logSuccess }: UploadOptions = {}) => {
  const kv = await Deno.openKv()
  const manager = new Manager({ kv, logSuccess })

  try {
    const openApiSchema = await OpenApiSchema.open(path)

    const schemaUpload = new SchemaUpload(manager)

    const schema = await schemaUpload.upload(openApiSchema)
  } catch (error) {
    manager.fail('Failed to upload schema')
  }
}
