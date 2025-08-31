import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'

export const description = 'Get project info'

export const toWorkspacesInfoCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_, projectName) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      await info({ project, skmtcRoot }, { logSuccess: 'Workspace retrieved' })
    })
}

export const toWorkspacesInfoPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  await info({ project, skmtcRoot })
}

type InfoArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
}

type InfoOptions = {
  logSuccess?: string
}

export const info = async ({ project, skmtcRoot }: InfoArgs, { logSuccess }: InfoOptions = {}) => {
  try {
    const workspace = new Workspace()

    const { name, id } = await workspace.getWorkspace({ project, skmtcRoot })

    console.log(`${name} (${id})`)

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to get workspace')
  }
}
