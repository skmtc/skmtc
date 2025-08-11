import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import { upload } from '../schemas/upload.ts'
import { join } from '@std/path'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const description = 'Generate local artifacts'

export const toWorkspacesGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, project, path) => {
      if (watch) {
        setupWatcher({ projectName: project, skmtcRoot, path })
      } else {
        await generate({ projectName: project, skmtcRoot }, { logSuccess: 'Artifacts generated' })
      }
    })
}

export const toWorkspacesGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  await generate({ projectName, skmtcRoot })
}

type WatchGenerateArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  path: string
}

export const setupWatcher = ({ projectName, skmtcRoot, path }: WatchGenerateArgs) => {
  const joinedPath = join(Deno.cwd(), path)

  const watcher = chokidar.watch(joinedPath)

  watcher.on('change', () => uploadGenerate({ projectName, skmtcRoot, path }))
}

type UploadGenerateArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
  path: string
}

const uploadGenerate = async ({ projectName, skmtcRoot, path }: UploadGenerateArgs) => {
  await upload({ projectName, skmtcRoot, path }, { logSuccess: 'Schema uploaded' })

  await generate({ projectName, skmtcRoot }, { logSuccess: 'Artifacts generated' })
}

type GenerateArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

type GenerateOptions = {
  logSuccess?: string
}

export const generate = async (
  { projectName, skmtcRoot }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  try {
    const workspace = new Workspace()

    await workspace.generateArtifacts({ projectName, skmtcRoot })

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to generate artifacts')
  }
}
