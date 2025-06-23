import { Command } from '@cliffy/command'
import { Manager } from '../lib/manager.ts'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import { upload } from '../schemas/upload.ts'
import { join } from 'node:path'

export const description = 'Generate artifacts in workspace'

export const toWorkspacesGenerateCommand = () => {
  return new Command()
    .description(description)
    .option('-w, --watch <path:string>', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }) => {
      if (watch) {
        setupWatcher({ watch })
      } else {
        await generate({ logSuccess: 'Artifacts generated' })
      }
    })
}

export const toWorkspacesGeneratePrompt = async () => {
  await generate()
}

type WatchGenerateArgs = {
  watch: string
}

export const setupWatcher = ({ watch }: WatchGenerateArgs) => {
  const joinedPath = join(Deno.cwd(), watch)

  const watcher = chokidar.watch(joinedPath)

  watcher.on('change', path => uploadGenerate({ path }))
}

type UploadGenerateArgs = {
  path: string
}

const uploadGenerate = async ({ path }: UploadGenerateArgs) => {
  await upload({ path }, { logSuccess: 'Schema uploaded' })

  await generate({ logSuccess: 'Artifacts generated' })
}

type GenerateArgs = {
  logSuccess?: string
}

export const generate = async ({ logSuccess }: GenerateArgs = {}) => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv, logSuccess })

  try {
    const kvState = new KvState(kv)
    const apiClient = new ApiClient(manager)

    const workspace = new Workspace()

    await workspace.generateArtifacts({ kvState, apiClient })

    manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to generate artifacts')
  }
}
