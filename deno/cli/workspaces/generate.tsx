import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import { Workspace } from '../lib/workspace.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Project } from '../lib/project.ts'
import { formatNumber, toGenerationStats, type GenerationStats } from '@skmtc/core'
import type { RemoteProject } from '../lib/remote-project.ts'
import { render } from 'ink'
import { App } from '../components/App.tsx'
import type { PrettierConfigType } from '@skmtc/core'
import type { ClientSettings } from '@skmtc/core/Settings'

export const description = 'Generate artifacts'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [schema:string]')
    .option('-w, --watch', 'Watch for changes to schema and generate artifacts')
    .action(async ({ watch }, projectName, schemaSourceString) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{ page: 'generate', projectName, schemaSourceString, watchMode: Boolean(watch) }}
          interactive={false}
        />
      )
    })
}

type GenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  interactive: boolean
  schemaContents: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
}

type GenerateOptions = {
  logSuccess?: string
}

export const generate = async ({
  project,
  skmtcRoot,
  interactive,
  schemaContents,
  clientSettings,
  prettier
}: GenerateArgs) => {
  try {
    const workspace = new Workspace()

    const { artifacts, manifest } = await workspace.generateArtifacts({
      project,
      schemaContents,
      clientSettings,
      prettier
    })

    const stats = toGenerationStats({ manifest, artifacts })

    if (stats.errors.length) {
      console.error(
        `Generation completed with ${formatNumber(stats.errors.length)} errors. View runtime logs for more info.`
      )
    }

    if (!interactive) {
      console.log(toGenerateStatus(stats))
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

export const toGenerateStatus = ({ files, lines, tokens, totalTime }: GenerationStats) => {
  return `Generated ${formatNumber(files)} files (${formatNumber(lines)} lines, ${formatNumber(tokens)} tokens) in ${formatNumber(totalTime)}ms`
}
