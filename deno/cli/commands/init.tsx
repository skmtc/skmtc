import React from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import { Command } from '@cliffy/command'

type RenderInitFn = (args: RenderInitArgs) => Promise<void>

export const toInitCommand = (skmtcRoot: SkmtcRoot, renderInit: RenderInitFn) => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('[projectName:string] [basePath:string]')
    .action(async (_options, projectName, basePath) => {
      await renderInit({ skmtcRoot, projectName, basePath })
    })

  return command
}

type RenderInitArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
}

export const renderInit = async ({
  skmtcRoot,
  projectName,
  basePath,
  renderFn = render,
  AppComponent = App
}: RenderInitArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'create-project', projectName, basePath },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
