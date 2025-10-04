import React from 'react'
import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '@/lib/workspace.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { isProjectKey, type Project } from '@/lib/project.ts'
import { formatNumber, toGenerationStats, type GenerationStats } from '@skmtc/core'
import { RemoteProject } from '@/lib/remote-project.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { PrettierConfigType } from '@skmtc/core'
import type { ClientSettings } from '@skmtc/core/Settings'
import { SchemaFile } from '@/lib/schema-file.ts'

export const description = 'Generate artifacts'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName, schemaSourceString) => {
      const session = await skmtcRoot.manager.auth.toSession()

      const project = isProjectKey(projectName)
        ? await RemoteProject.fromKey({
            projectKey: projectName,
            schemaFile: schemaSourceString
              ? await SchemaFile.openFromSource(schemaSourceString)
              : SchemaFile.create(),
            manager: skmtcRoot.manager
          })
        : skmtcRoot.findProject(projectName)

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{ page: 'generate', project, schemaSourceString, watchMode: Boolean(watch) }}
          interactive={false}
        />
      )
    })
}

type GenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  accountName: string
  interactive: boolean
  schemaContents: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
  token: string
}

export const generate = async ({
  project,
  skmtcRoot,
  accountName,
  interactive,
  schemaContents,
  clientSettings,
  prettier,
  token
}: GenerateArgs) => {
  try {
    const workspace = new Workspace()

    const result = await workspace.generateArtifacts({
      project,
      accountName,
      schemaContents,
      clientSettings,
      prettier,
      token
    })

    if (!result) {
      console.error('Failed to generate artifacts')
      return
    }

    const { artifacts, manifest } = result

    const stats = toGenerationStats({ manifest, artifacts })

    if (!interactive) {
      const statusMessages = toGenerateStatus(stats)

      const message = Object.values(statusMessages).join('\n')

      console.log(message)
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

type StatusMessages = {
  main: string
  sub?: string
}

export const toGenerateStatus = (stats: GenerationStats): StatusMessages => {
  const { files, tokens, totalTime, errors } = stats

  const main = `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`

  return errors.length
    ? {
        main,
        sub: `${formatNumber(errors.length)} errors detected - view runtime logs for details`
      }
    : { main }
}
