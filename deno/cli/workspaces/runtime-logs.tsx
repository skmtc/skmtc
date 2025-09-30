import React from 'react'
import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import invariant from 'tiny-invariant'
import type { Project } from '@/lib/project.ts'
import { getApiDeploymentsDeploymentIdRuntimeLogs } from '@/services/getApiDeploymentsDeploymentIdRuntimeLogs.generated.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

export const description = 'View runtime logs'

export const toRuntimeLogsCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_, projectName) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{ page: 'runtime-logs', projectName }}
          interactive={false}
        />
      )
    })
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
      until: new Date(manifest.endAt).toISOString(),
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
