import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { Manager } from '../lib/manager.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from '@sentry/deno'
import { KvState } from '../lib/kv-state.ts'

export const description = 'Unlink an OpenAPI schema from its uploaded counterpart'

export const toUnlinkCommand = () => {
  return new Command()
    .description(description)
    .arguments('<path:string>')
    .action(async (_, path) => {
      await unlink({ path })
    })
}

export const toUnlinkPrompt = async () => {
  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })

  await unlink({ path }, { logSuccess: 'Schema unlinked' })
}

type UnlinkArgs = {
  path: string
}

type UnlinkOptions = {
  logSuccess?: string
}

export const unlink = async ({ path }: UnlinkArgs, { logSuccess }: UnlinkOptions = {}) => {
  const kv = await Deno.openKv()
  const kvState = new KvState(kv)

  const manager = new Manager({ kv, logSuccess })

  try {
    const openApiSchema = await OpenApiSchema.open(path)

    await openApiSchema.unlink({ kvState })

    manager.success()
  } catch (error) {
    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to upload schema')
  }
}
