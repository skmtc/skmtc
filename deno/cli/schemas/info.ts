import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from '@sentry/deno'
import { KvState } from '../lib/kv-state.ts'

export const description = 'Get schemas info'

export const toInfoCommand = () => {
  return new Command()
    .description(description)
    .arguments('<path:string>')
    .action(async (_, path) => {
      await info({ path })
    })
}

export const toInfoPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  await info({ path })
}

type InfoArgs = {
  path: string
}

type InfoOptions = {
  logSuccess?: string
}

export const info = async ({ path }: InfoArgs, { logSuccess }: InfoOptions = {}) => {
  const kv = await Deno.openKv()
  const kvState = new KvState(kv)

  const manager = new Manager({ kv, logSuccess })

  try {
    const openApiSchema = await OpenApiSchema.open(path)
    const info = await openApiSchema.info({ kvState })

    console.log(`${openApiSchema.path} (${info})`)

    await manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to upload schema')
  }
}
