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
import { formatNumber, toGenerationStats } from '@skmtc/core'
import { type KeyCode, parse } from '@cliffy/keycode'

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

export const toWorkspacesGenerateWatchPrompt = async (
  skmtcRoot: SkmtcRoot,
  projectName: string
) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project?.schemaFile, 'Schema file not found')

  const schemaPath = project.schemaFile.toPath()

  setupWatcher({ project, skmtcRoot, path: schemaPath })

  console.log(`Watching ${schemaPath}...`)
  console.log('Hit ctrl + c to exit.')

  for await (const key of keypress()) {
    if (key.ctrl && key.name === 'c') {
      return
    }
    console.log(key)
  }
}

type WatchGenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  path: string
}

export const setupWatcher = ({ project, skmtcRoot, path }: WatchGenerateArgs) => {
  console.log('setupWatcher', path)

  // const joinedPath = join(Deno.cwd(), path)

  const watcher = chokidar.watch(path)

  watcher.on('change', () => {
    generate({ project, skmtcRoot })
  })
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

    const { artifacts, manifest } = await workspace.generateArtifacts({ project, skmtcRoot })

    spinner.stop()

    const { tokens, lines, totalTime, errors, files } = toGenerationStats({ manifest, artifacts })

    if (errors.length) {
      console.error(`Generation failed with ${formatNumber(errors.length)} errors`)
    } else {
      console.log(
        `Generated ${formatNumber(files)} files (${formatNumber(lines)} lines, ${formatNumber(tokens)} tokens) in ${formatNumber(totalTime)}ms`
      )
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

async function* keypress(): AsyncGenerator<KeyCode, void> {
  while (true) {
    const data = new Uint8Array(8)

    Deno.stdin.setRaw(true)
    const nread = await Deno.stdin.read(data)
    Deno.stdin.setRaw(false)

    if (nread === null) {
      return
    }

    const keys: Array<KeyCode> = parse(data.subarray(0, nread))

    for (const key of keys) {
      yield key
    }
  }
}
