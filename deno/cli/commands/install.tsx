import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

export const description = 'Install generator'

type RenderInstallFn = (args: RenderInstallArgs) => Promise<void>

export const toInstallCommand = (skmtcRoot: SkmtcRoot, renderInstall: RenderInstallFn) => {
  const command = new Command()
    .description(description)
    .arguments('[generators:string[]] [project:string]')
    .action(async (_options, generators, projectName) => {
      await renderInstall({ skmtcRoot, generators, projectName })
    })

  return command
}

type RenderInstallArgs = {
  skmtcRoot: SkmtcRoot
  generators: string[] | undefined
  projectName: string | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderInstall = async ({
  skmtcRoot,
  generators,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderInstallArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'install-generator', projectName, generators },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
