import { Command } from '@cliffy/command'
import { Input, Select } from '../components/index.ts'
import * as Sentry from '@sentry/node'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'

export const description = 'Pull base files from deployed workspace'

export const toBaseFilesPullCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .action(async (_args, project, path) => {
      return await pull({ projectName: project, skmtcRoot })
    })
}

export const toBaseFilesPullPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Select.prompt({
    message: 'Select project to deploy generators to',
    options: skmtcRoot.projects.map(({ name }) => ({
      name,
      value: name
    }))
  })

  const path = await Input.prompt({
    message: 'Enter destination path for base files'
  })

  await pull({ projectName, skmtcRoot })
}

type PullArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

export const pull = async ({ projectName, skmtcRoot }: PullArgs) => {
  try {
    const workspace = getApiWorkspacesWorkspaceName({
      workspaceName: projectName,
      supabase: skmtcRoot.manager.auth.supabase
    })

    console.log('WORKSPACE', workspace)
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    await skmtcRoot.manager.fail('Failed to pull base files')
  }
}
