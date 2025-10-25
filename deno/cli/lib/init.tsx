import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Instance, RenderOptions } from 'ink'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export type InkRenderFn = (
  node: React.ReactNode,
  options?: NodeJS.WriteStream | RenderOptions
) => Instance

type RenderInitFn = (args: RenderInitArgs) => Promise<void>

export const toInitCommand = (skmtcRoot: SkmtcRoot, renderInit: RenderInitFn) => {
  const command = new Command()
    .description('Initialize a new project in current directory')
    .arguments('[projectName:string] [generators:string[]] [basePath:string]')
    .action(async (_options, projectName, generators, basePath) => {
      await renderInit({ skmtcRoot, projectName, generators, basePath })
    })

  return command
}

type RenderInitArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
}

export const renderInit = async ({
  skmtcRoot,
  projectName,
  generators,
  basePath,
  renderFn = render,
  AppComponent = App
}: RenderInitArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'create-project', projectName, generators, basePath },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
