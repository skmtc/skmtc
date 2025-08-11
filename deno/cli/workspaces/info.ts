import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { Input } from '@cliffy/prompt'

export const description = 'Get workspace info'

export const toWorkspacesInfoCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_, project) => {
      await info({ projectName: project, skmtcRoot }, { logSuccess: 'Workspace retrieved' })
    })
}

export const toWorkspacesInfoPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project to get workspace info for',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  await info({ projectName, skmtcRoot })
}

type InfoArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

type InfoOptions = {
  logSuccess?: string
}

export const info = async (
  { projectName, skmtcRoot }: InfoArgs,
  { logSuccess }: InfoOptions = {}
) => {
  try {
    const workspace = new Workspace()

    const { name, id } = await workspace.getWorkspace({ projectName, skmtcRoot })

    console.log(`${name} (${id})`)

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to get workspace')
  }
}
