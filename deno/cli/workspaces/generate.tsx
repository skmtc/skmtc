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
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import { PrettierJson } from '../lib/prettier-json.ts'

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
            prettierPath: PrettierJson.toPath(projectName),
            manager: skmtcRoot.manager
          })
        : skmtcRoot.findProject(projectName)

      const initialState: SkmtcState = {
        view: {
          page: 'generate',
          project,
          schemaSourceString,
          watchMode: Boolean(watch),
          basePath: project.clientJson.contents?.settings.basePath
        },
        skmtcRoot,
        session,
        message: null,
        interactive: false,
        shortcuts: [],
        generators: []
      }

      render(<App initialState={initialState} />)
    })
}

type GenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  accountName: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
  token: string | undefined
}

export const generate = async ({
  project,
  skmtcRoot,
  accountName,
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

    const { artifacts, manifest } = result

    const stats = toGenerationStats({ manifest, artifacts })

    await skmtcRoot.manager.cleanup()

    return stats
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    Sentry.captureException(error)

    await Sentry.flush()

    await skmtcRoot.manager.cleanup()

    throw error
  }
}

export const toGenerateMessage = (stats: GenerationStats): SuccessMessage => {
  const { files, tokens, totalTime, errors } = stats

  const success = `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`

  return errors.length
    ? {
        success,
        sub: `${formatNumber(errors.length)} errors detected - view runtime logs for details`
      }
    : { success }
}
