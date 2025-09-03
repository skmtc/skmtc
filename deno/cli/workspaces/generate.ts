import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'
import { Spinner } from '../lib/spinner.ts'
import { formatNumber, toGenerationStats } from '@skmtc/core'
import { keypress } from '../lib/keypress.ts'
import { relative } from '@std/path/relative'
import { dim } from '@std/fmt/colors'
import { Confirm } from '@cliffy/prompt'

export const description = 'Generate artifacts'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('[project:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName) => {
      const projects = projectName
        ? skmtcRoot.projects.filter(({ name }) => name === projectName)
        : skmtcRoot.projects

      const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

      spinner.start()

      if (watch) {
        projects.forEach(project => {
          setupWatcher({ project, skmtcRoot, spinner })
        })
      } else {
        const promises = projects.map(project => {
          return generate({ project, skmtcRoot, spinner }, { logSuccess: 'Artifacts generated' })
        })

        await Promise.all(promises)

        spinner.stop()
      }
    })
}

export const toGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  const hasDeployment = await ensureDeployment({ project })

  if (!hasDeployment) {
    console.log('Project has not been deployed. Please deploy before generating artifacts.')

    return
  }

  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  await generate({ project, skmtcRoot, spinner })

  spinner.stop()
}

export const toGenerateWatchPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project?.schemaFile, 'Schema file not found')

  const schemaPath = project.schemaFile.toPath()

  const hasDeployment = await ensureDeployment({ project })

  if (!hasDeployment) {
    console.log('Project has not been deployed. Please deploy before generating artifacts.')

    return
  }

  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  setupWatcher({ project, skmtcRoot, spinner })

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
  spinner: Spinner
}

export const setupWatcher = ({ project, skmtcRoot, spinner }: WatchGenerateArgs) => {
  const schemaPath = project.schemaFile?.toPath()

  invariant(
    schemaPath,
    `Schema file not found. Please add an "openapi.json" or "openapi.yaml" file to ".skmtc/${project.name}" or ".skmtc" folder.`
  )

  const watcher = chokidar.watch(schemaPath)
  watcher.on('change', () => {
    generate({ project, skmtcRoot, spinner, watching: true })
  })
}

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

    await project.schemaFile?.refresh()

    const { artifacts, manifest } = await workspace.generateArtifacts({ project, skmtcRoot })

    const { tokens, lines, totalTime, errors, files } = toGenerationStats({ manifest, artifacts })

    if (errors.length) {
      console.error(
        `Generation completed with ${formatNumber(errors.length)} errors. View runtime logs for more info.`
      )
    }

    const message = `Generated ${formatNumber(files)} files (${formatNumber(lines)} lines, ${formatNumber(tokens)} tokens) in ${formatNumber(totalTime)}ms`

    if (watching) {
      spinner.message = message
    } else {
      console.log(message)
    }

    await skmtcRoot.manager.success()
  } catch (error) {
    spinner.stop()

    console.error(error instanceof Error ? error.message : 'Failed to generate artifacts')

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail()
  }
}

type EnsureDeploymentIdArgs = {
  project: Project
}

const ensureDeployment = async ({ project }: EnsureDeploymentIdArgs): Promise<boolean> => {
  const { serverOrigin } = project.clientJson.contents

  if (serverOrigin) {
    return true
  }

  const confirmed = await Confirm.prompt(
    'This project has not been deployed. Would you like to deploy it now?'
  )

  if (!confirmed) {
    return false
  }

  await project.deploy({ logSuccess: 'Generators deployed' })

  return true
}
