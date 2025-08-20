import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import { upload } from '../schemas/upload.ts'
import { join } from '@std/path'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'
import { Spinner } from '../lib/spinner.ts'

export const description = 'Generate artifacts'

export const toWorkspacesGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName, path) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      if (watch) {
        setupWatcher({ project, skmtcRoot, path })
      } else {
        await generate({ project, skmtcRoot }, { logSuccess: 'Artifacts generated' })
      }
    })
}

export const toWorkspacesGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  await generate({ project, skmtcRoot })
}

type WatchGenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  path: string
}

export const setupWatcher = ({ project, skmtcRoot, path }: WatchGenerateArgs) => {
  const joinedPath = join(Deno.cwd(), path)

  const watcher = chokidar.watch(joinedPath)

  watcher.on('change', () => uploadGenerate({ project, skmtcRoot, path }))
}

type UploadGenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  path: string
}

const uploadGenerate = async ({ project, skmtcRoot, path }: UploadGenerateArgs) => {
  await upload({ project, skmtcRoot, path }, { logSuccess: 'Schema uploaded' })

  await generate({ project, skmtcRoot }, { logSuccess: 'Artifacts generated' })
}

type GenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
}

type GenerateOptions = {
  logSuccess?: string
}

export const generate = async (
  { project, skmtcRoot }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  try {
    const workspace = new Workspace()

    await workspace.generateArtifacts({ project, skmtcRoot })

    spinner.stop()

    await skmtcRoot.manager.success()
  } catch (error) {
    spinner.stop()

    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to generate artifacts')
  }
}
