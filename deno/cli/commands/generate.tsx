import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { isProjectKey, type Project } from '@/lib/project.ts'
import { formatNumber } from '@skmtc/core'
import type { GenerationStats } from '@/lib/generationStats.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

import { SchemaFile } from '@/lib/schema-file.ts'
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import { PrettierJson } from '@/lib/prettier-json.ts'
import type { InkRenderFn } from '@/commands/types.ts'

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
    interactive: true,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
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
