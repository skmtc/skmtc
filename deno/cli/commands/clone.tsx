import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

export const description = 'Clone generator'

type RenderCloneFn = (args: RenderCloneArgs) => Promise<void>

export const toCloneCommand = (skmtcRoot: SkmtcRoot, renderClone: RenderCloneFn) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      await renderClone({ skmtcRoot, projectName })
    })

  return command
}

type RenderCloneArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderClone = async ({
  skmtcRoot,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderCloneArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'clone-generator', projectName },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
