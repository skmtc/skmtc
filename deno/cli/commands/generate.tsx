import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { isProjectKey, Project } from '@/lib/project.ts'
import { formatNumber } from '@skmtc/core/formatNumber'
import type { GenerationStats } from '@/lib/generationStats.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import { SchemaFile } from '@/lib/schema-file.ts'
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import { PrettierJson } from '@/lib/prettier-json.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import { existsSync } from '@std/fs/exists'
import invariant from 'tiny-invariant'
import { generate } from '../lib/generate.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'

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

  const checks = checkGenerateParams({ project, schemaSourceString })

  if (hasRequiredParams(checks)) {
    invariant(project instanceof Project, 'Project must be a local project')

    const schemaContents = await toSchemaContents(
      schemaSourceString ?? project.clientJson.contents?.source ?? ''
    )

    await generate({
      project,
      bundlePath: toBundlePath(project.toPath()),
      skmtcRoot,
      accountName: session?.user.user_metadata.user_name,
      schemaContents,
      clientSettings: project.clientJson.contents?.settings,
      token: session?.access_token
    })

    Deno.exit(0)
  }

  const initialState: SkmtcState = {
    view: {
      page: 'generate',
      project,
      schemaSourceString,
      watchMode: Boolean(watch)
    },
    skmtcRoot,
    session,
    message: null,
    interactive: true,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

const hasRequiredParams = (checks: GenerateChecks): boolean => {
  return checks.hasBasePath && checks.hasSchemaSource && checks.hasBundle && checks.hasWatchMode
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

type GenerateChecks = {
  hasBasePath: boolean
  hasSchemaSource: boolean
  hasBundle: boolean
  hasWatchMode: boolean
}

type CheckGenerateParamsArgs = {
  project: Project | RemoteProject
  schemaSourceString: string | undefined
}

const checkGenerateParams = ({
  project,
  schemaSourceString
}: CheckGenerateParamsArgs): GenerateChecks => {
  invariant(project instanceof Project, 'Project must be a local project')

  const basePath = project.clientJson.contents?.settings.basePath
  const schemaSource = schemaSourceString ?? project.clientJson.contents?.source
  const hasBundle = existsSync(toBundlePath(project.toPath()))

  const hasBasePath = typeof basePath === 'string'
  const hasSchemaSource = typeof schemaSource === 'string'

  const checks = {
    hasBasePath,
    hasSchemaSource,
    hasBundle,
    hasWatchMode: true
  }

  return checks
}
