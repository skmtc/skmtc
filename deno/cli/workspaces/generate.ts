import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '../lib/workspace.ts'
import chokidar from 'chokidar'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import { Project } from '../lib/project.ts'
import { formatNumber, toGenerationStats, type GenerationStats } from '@skmtc/core'
import { keypress } from '../lib/keypress.ts'
import { relative } from '@std/path/relative'
import type { RemoteProject } from '../lib/remote-project.ts'
// import { toMessage } from '../lib/to-message.tsx'
import { toSpinner } from '../lib/to-spinner.tsx'

export const description = 'Generate artifacts'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .option('-p, --prettier <path:string>', 'Path to prettier config file')
    .action(async ({ watch, prettier }, projectName, path) => {
      const project = await skmtcRoot.toProject({
        projectName,
        schemaPath: path,
        prettierPath: prettier
      })

      if (watch) {
        setupWatcher({ project, skmtcRoot })
      } else {
        await generate({ project, skmtcRoot }, { logSuccess: 'Artifacts generated' })
      }
    })
}

export const toGeneratePrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = await skmtcRoot.toProject({
    projectName,
    schemaPath: undefined,
    prettierPath: undefined
  })

  const hasDeployment = await project.ensureDeployment()

  if (!hasDeployment) {
    console.log('Project has not been deployed. Please deploy before generating artifacts.')

    return
  }

  toSpinner({ message: 'Generating...' })

  await generate({ project, skmtcRoot })
}

export const toGenerateWatchPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.findProject(projectName)

  await project.schemaFile.promptOrFail(project)

  const { schemaSource } = project.schemaFile

  invariant(schemaSource?.type === 'local', 'Only local schema files can be watched')

  const hasDeployment = await project.ensureDeployment()

  if (!hasDeployment) {
    console.log('Project has not been deployed. Please deploy before generating artifacts.')

    return
  }

  setupWatcher({ project, skmtcRoot })

  const relativePath = relative(Deno.cwd(), schemaSource.path)

  toSpinner({ message: `Watching ${relativePath}`, sub: `Hit 'escape' key to stop.` })

  for await (const key of keypress()) {
    if (key.ctrl && key.name === 'c') {
      // toMessage({ messages: [] })

      return
    }

    if (key.name === 'escape') {
      // toMessage({ messages: [] })

      return
    }
  }
}

type WatchGenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
}

export const setupWatcher = ({ project, skmtcRoot }: WatchGenerateArgs) => {
  const { schemaSource } = project.schemaFile

  invariant(schemaSource?.type === 'local', 'Only local schema files can be watched')

  const watcher = chokidar.watch(schemaSource.path)
  watcher.on('change', async () => {
    await generate({ project, skmtcRoot, watching: true })

    toSpinner({ message: `Watching ${schemaSource.path}`, sub: `Hit 'escape' key to stop.` })
  })
}

type GenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  interactive?: boolean
}

type GenerateOptions = {
  logSuccess?: string
}

export const generate = async (
  { project, skmtcRoot, interactive }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  try {
    const workspace = new Workspace()

    await project.clientJson?.refresh()

    throw new Error('Remove promptOrFail and ensure data is available before calling generate')

    if (project) {
      await project.schemaFile.promptOrFail(project)
    }

    await project.prettierJson?.refresh()

    const { artifacts, manifest } = await workspace.generateArtifacts({ project, skmtcRoot })

    const stats = toGenerationStats({ manifest, artifacts })

    if (stats.errors.length) {
      console.error(
        `Generation completed with ${formatNumber(stats.errors.length)} errors. View runtime logs for more info.`
      )
    }

    if (!interactive) {
      console.log(toGenerateStatus(stats))
    }

    await skmtcRoot.manager.success()

    return stats
  } catch (error) {
    console.log('ERROR', error)

    console.error(error instanceof Error ? error.message : 'Failed to generate artifacts')

    Sentry.captureException(error)

    await Sentry.flush()

    await skmtcRoot.manager.fail()
  }
}

export const toGenerateStatus = ({ files, lines, tokens, totalTime }: GenerationStats) => {
  return `Generated ${formatNumber(files)} files (${formatNumber(lines)} lines, ${formatNumber(tokens)} tokens) in ${formatNumber(totalTime)}ms`
}
