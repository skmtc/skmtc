import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { ApiClient } from '../lib/api-client.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/node'
import { BaseFiles } from '../lib/base-files.ts'
// import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const description = 'Push base files to Skmtc'

// @TODO Needs deeper refactor
// export const toDescription = async (skmtcRoot: SkmtcRoot): Promise<string> => {
//   try {
//     const apiClient = new ApiClient(skmtcRoot.manager)

//     const workspace = new Workspace()

//     const isLoggedIn = await apiClient.manager.auth.isLoggedIn()

//     if (!isLoggedIn) {
//       await skmtcRoot.manager.success()
//       return 'Log in to push base files'
//     }

//     const accountName = await apiClient.manager.auth.toUserName()

//     const workspaceRes = await workspace.getWorkspace({
//       projectName: skmtcRoot.projectName,
//       skmtcRoot
//     })

//     if (!workspaceRes) {
//       await skmtcRoot.manager.success()
//       return 'Create workspace to push base files'
//     }

//     const { name } = workspaceRes

//     await skmtcRoot.manager.success()

//     return `Push base files to @${accountName}/${name}`
//   } catch (error) {
//     console.error(error)

//     Sentry.captureException(error)

//     await Sentry.flush()

//     skmtcRoot.manager.fail('Failed to get workspace')

//     Deno.exit(1)
//   }
// }

export const toBaseFilesPushCommand = (_skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .action(async (_args, project, path) => {
      await push({ projectName: project, path })
    })
}

export const toBaseFilesPushPrompt = async (_skmtcRoot: SkmtcRoot, projectName: string) => {
  const path = await Input.prompt({
    message: 'Enter path to base files folder'
  })

  await push({ projectName, path })
}

type PushArgs = {
  projectName: string
  path: string
}

export const push = async ({ projectName, path }: PushArgs) => {
  const manager = new Manager()

  try {
    const apiClient = new ApiClient(manager)
    const baseFiles = new BaseFiles(path)

    await baseFiles.push({ projectName, apiClient })
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    await manager.fail('Failed to push base files')
  }
}
