import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import { upload } from '../schemas/upload.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'
import { Spinner } from '../lib/spinner.ts'
import { formatNumber, toGenerationStats } from '@skmtc/core'
import { keypress } from '../lib/keypress.ts'
import { relative } from '@std/path'
import { dim } from '@std/fmt/colors'

export const description = 'Generate artifacts'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName, path) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

      spinner.start()

      if (watch) {
        setupWatcher({ project, skmtcRoot, path, spinner })
      } else {
        await generate({ project, skmtcRoot, spinner }, { logSuccess: 'Artifacts generated' })

        spinner.stop()
      }
    })
}

export const toGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  await generate({ project, skmtcRoot, spinner })

  spinner.stop()
}

export const toGenerateWatchPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project?.schemaFile, 'Schema file not found')

  const schemaPath = project.schemaFile.toPath()

  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  setupWatcher({ project, skmtcRoot, path: schemaPath, spinner })

  const relativePath = relative(Deno.cwd(), schemaPath)

  spinner.message = `Watching ${relativePath}`

  console.log(dim(`Hit 'escape' key to stop.`))

  for await (const key of keypress()) {
    if (key.ctrl && key.name === 'c') {
      spinner.stop()

      return
    }

    if (key.name === 'escape') {
      spinner.stop()

      return
    }
  }
}

type WatchGenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  path: string
  spinner: Spinner
}

export const setupWatcher = ({ project, skmtcRoot, path, spinner }: WatchGenerateArgs) => {
  const watcher = chokidar.watch(path)
  watcher.on('change', () => {
    generate({ project, skmtcRoot, spinner, watching: true })
  })
}

// type UploadGenerateArgs = {
//   project: Project
//   skmtcRoot: SkmtcRoot
//   path: string
// }

// const uploadGenerate = async ({ project, skmtcRoot, path }: UploadGenerateArgs) => {
//   await upload({ project, skmtcRoot, path }, { logSuccess: 'Schema uploaded' })

//   const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

//   spinner.start()

//   await generate({ project, skmtcRoot, spinner }, { logSuccess: 'Artifacts generated' })
// }

type GenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  spinner: Spinner
  watching?: boolean
}

type GenerateOptions = {
  logSuccess?: string
}

export const generate = async (
  { project, skmtcRoot, spinner, watching }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  try {
    const workspace = new Workspace()

    const { artifacts, manifest } = await workspace.generateArtifacts({ project, skmtcRoot })

    const { tokens, lines, totalTime, errors, files } = toGenerationStats({ manifest, artifacts })

    if (errors.length) {
      console.error(`Generation failed with ${formatNumber(errors.length)} errors`)
    } else {
      const message = `Generated ${formatNumber(files)} files (${formatNumber(lines)} lines, ${formatNumber(tokens)} tokens) in ${formatNumber(totalTime)}ms`

      if (watching) {
        spinner.message = `Watching... ${message}`
      } else {
        console.log(message)
      }
    }

    await skmtcRoot.manager.success()
  } catch (error) {
    spinner.stop()

    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to generate artifacts')
  }
}
