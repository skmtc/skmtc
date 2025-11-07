import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { isProjectKey, type Project } from '@/lib/project.ts'
import { formatNumber } from '@skmtc/core'
import { toGenerationStats, type GenerationStats } from '@/lib/generationStats.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { ClientSettings } from '@skmtc/core/Settings'
import { SchemaFile } from '@/lib/schema-file.ts'
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import { PrettierJson } from '@/lib/prettier-json.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import { generateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'

type ToProjectArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  schemaSourceString: string | undefined
}

export const toProject = async ({
  skmtcRoot,
  projectName,
  schemaSourceString
}: ToProjectArgs): Promise<Project | RemoteProject> => {
  if (isProjectKey(projectName)) {
    return await RemoteProject.fromKey({
      projectKey: projectName,
      schemaFile: schemaSourceString
        ? await SchemaFile.openFromSource(schemaSourceString)
        : SchemaFile.create(),
      prettierPath: PrettierJson.toPath(projectName),
      manager: skmtcRoot.manager
    })
  }

  return skmtcRoot.findProject(projectName)
}

type RenderGenerateArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderGenerate = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  schemaSourceString,
  watch,
  renderFn = render,
  AppComponent = App
}: RenderGenerateArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const session = await skmtcRoot.manager.auth.toSession()

  const project = await toProject({ skmtcRoot, projectName, schemaSourceString })

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

  renderFn(<AppComponent initialState={initialState} />)
}

type GenerateArgs = {
  project: Project | RemoteProject
  skmtcRoot: SkmtcRoot
  accountName: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
  token: string | undefined
}

export const generate = async ({
  project,
  skmtcRoot,
  accountName,
  schemaContents,
  clientSettings,
  token
}: GenerateArgs) => {
  try {
    const { artifacts, manifest } = await generateArtifacts({
      project,
      accountName,
      schemaContents,
      clientSettings,
      token
    })

    const manifestPath = project.toManifestPath()

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest
    })

    const stats = toGenerationStats({ manifest, artifacts })

    await skmtcRoot.manager.cleanup()

    return stats
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    // Sentry.captureException(error)

    // await Sentry.flush()

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
