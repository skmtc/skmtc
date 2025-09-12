import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '../lib/project.ts'
import { getApiDeploymentsDeploymentIdRuntimeLogs } from '../services/getApiDeploymentsDeploymentIdRuntimeLogs.generated.ts'

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

    const runtimeLogs = await getApiDeploymentsDeploymentIdRuntimeLogs({
      deploymentId: manifest.deploymentId,
      q: manifest.spanId,
      since: new Date(manifest.startAt).toISOString(),
      supabase: skmtcRoot.manager.auth.supabase
    })

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

    await skmtcRoot.manager.fail('Failed to get runtime logs')
  }
}
