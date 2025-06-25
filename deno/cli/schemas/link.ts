import { Command } from '@cliffy/command'
import { Input, Select } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import * as Sentry from '@sentry/deno'

export const description = 'Link local schema to remote'

export const toSchemasLinkCommand = () => {
  return new Command()
    .description(description)
    .arguments('<path:string> <schema-id:string>')
    .action(async (_, path, schemaId) => {
      await link({ path, schemaId })
    })
}

type LinkArgs = {
  path: string
  schemaId: string
}

export const toSchemasLinkPrompt = async () => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  const apiClient = new ApiClient(manager)

  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  const schemas: { name: string; id: string }[] = await apiClient.getSchemas()

  const schemaId: string = await Select.prompt({
    message: 'Select a schema',
    options: schemas.map(({ name, id }) => ({ name, value: id }))
  })

  await link({ path, schemaId })
}

export const link = async ({ path, schemaId }: LinkArgs) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  try {
    const kvState = new KvState(kv)

    await kvState.setSchemaId({ path, schemaId })

    await manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to set workspace id')
  }
}
