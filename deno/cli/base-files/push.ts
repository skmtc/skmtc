import { Command } from '@cliffy/command'
import { Input } from '@cliffy/prompt'
import { ApiClient } from '../lib/api-client.ts'
import { KvState } from '../lib/kv-state.ts'
import { Manager } from '../lib/manager.ts'
import * as Sentry from '@sentry/deno'
import { BaseFiles } from '../lib/base-files.ts'
import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const toDescription = async (projectName: string): Promise<string> => {
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })
  const kvState = new KvState(kv)

  try {
    const apiClient = new ApiClient(manager)

    const workspace = new Workspace()

    const isLoggedIn = await apiClient.manager.auth.isLoggedIn()

    if (!isLoggedIn) {
      await manager.success()
      return 'Log in to push base files'
    }

    const accountName = await apiClient.manager.auth.toUserName()

    const workspaceRes = await workspace.getWorkspace({ projectName, kvState, apiClient })

    if (!workspaceRes) {
      await manager.success()
      return 'Create workspace to push base files'
    }

    const { name } = workspaceRes

    await manager.success()

    return `Push base files to @${accountName}/${name}`
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to get workspace')

    Deno.exit(1)
  }
}

export const toBaseFilesPushCommand = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const description = await toDescription(projectName)

  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .action(async (_args, project, path) => {
      await push({ projectName: project, path })
    })
}

export const toBaseFilesPushPrompt = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

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
  const kv = await Deno.openKv()

  const manager = new Manager({ kv })

  try {
    const kvState = new KvState(kv)
    const workspaceId = await kvState.getWorkspaceId(projectName)

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const apiClient = new ApiClient(manager)
    const baseFiles = new BaseFiles(path)

    await baseFiles.push({ projectName, kvState, apiClient })
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    manager.fail('Failed to push base files')
  }
}
