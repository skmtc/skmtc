import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

export const description = 'Remove generator'

type RenderRemoveFn = (args: RenderRemoveArgs) => Promise<void>

export const toRemoveCommand = (skmtcRoot: SkmtcRoot, renderRemove: RenderRemoveFn) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action(async (_options, projectName, generator) => {
      await renderRemove({ skmtcRoot, projectName, generator })
    })

  return command
}

type RenderRemoveArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generator: string
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderRemove = async ({
  skmtcRoot,
  projectName,
  generator,
  renderFn = render,
  AppComponent = App
}: RenderRemoveArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'remove-generator', projectName, generatorName: generator },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
