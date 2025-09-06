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
import type { RemoteProject } from '../lib/remote-project.ts'

export const description = 'Generate artifacts'

/* projectName 

starts with @
call remote api

starts with http:// or https://
call server

starts with anything else
call generator in ./skmtc (deno only)

should schema be optional in project?

schema
if starts with @
use remote api

if starts with http:// or https://
fetch it

use as path to file

*/

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .option('-p, --prettier <path:string>', 'Path to prettier config file')
    .action(async ({ watch, prettier }, projectKey, schemaPath) => {
      const project = await skmtcRoot.toProject({ projectKey, schemaPath, prettierPath: prettier })

      const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

      spinner.start()

      if (watch) {
        setupWatcher({ project, skmtcRoot, spinner })
      } else {
        await generate({ project, skmtcRoot, spinner }, { logSuccess: 'Artifacts generated' })

        spinner.stop()
      }
    })
}

export const toGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = await skmtcRoot.toProject({
    projectKey: projectName,
    schemaPath: undefined,
    prettierPath: undefined
  })

  const hasDeployment = await project.ensureDeployment()

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

  const schemaSource = project.schemaFile.toSource()

  invariant(schemaSource.type === 'local', 'Only local schema files can be watched')

  const hasDeployment = await project.ensureDeployment()

  if (!hasDeployment) {
    console.log('Project has not been deployed. Please deploy before generating artifacts.')

    return
  }

  const spinner = new Spinner({ message: 'Generating...', color: 'yellow' })

  spinner.start()

  setupWatcher({ project, skmtcRoot, spinner })

  const relativePath = relative(Deno.cwd(), schemaSource.path)

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
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  spinner: Spinner
}

export const setupWatcher = ({ project, skmtcRoot, spinner }: WatchGenerateArgs) => {
  const schemaSource = project.schemaFile?.toSource()

  invariant(schemaSource?.type === 'local', 'Only local schema files can be watched')

  const watcher = chokidar.watch(schemaSource.path)
  watcher.on('change', () => {
    generate({ project, skmtcRoot, spinner, watching: true })
  })
}

type GenerateArgs = {
  project: Project | RemoteProject
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
    await project.clientJson?.refresh()
    await project.prettierJson?.refresh()

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
