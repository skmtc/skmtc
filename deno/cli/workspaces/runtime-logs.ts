import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/deno'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'

export const description = 'View runtime logs'

export const toRuntimeLogsCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_, projectName) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      await runtimeLogs({ project, skmtcRoot })
    })
}

export const toRuntimeLogsPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  await runtimeLogs({ project, skmtcRoot })
}

type GenerateArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
}

type GenerateOptions = {
  logSuccess?: string
}

export const runtimeLogs = async (
  { project, skmtcRoot }: GenerateArgs,
  { logSuccess }: GenerateOptions = {}
) => {
  try {
    await project.manifest.refresh()

    const manifest = project.manifest.contents

    if (!manifest) {
      throw new Error('Project has no manifest. Has generation been run?')
    }

    const { deploymentId } = project.clientJson.contents

    if (!deploymentId) {
      throw new Error('Project has no deployment ID. Has it been deployed?')
    }

    const runtimeLogs = await skmtcRoot.apiClient.getRuntimeLogs(deploymentId, {
      spanId: manifest.spanId,
      since: new Date(manifest.startAt).toISOString()
    })

    // @ts-expect-error - TODO: fix this
    runtimeLogs.forEach(log => {
      try {
        const message = JSON.parse(log.message)
        console.error(message)
      } catch (error) {
        console.error(log.message)
      }
    })

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    skmtcRoot.manager.fail('Failed to get runtime logs')
  }
}
