import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/lib/init.tsx'

export const description = 'List generators'

type RenderListFn = (args: RenderListArgs) => Promise<void>

export const toListCommand = (skmtcRoot: SkmtcRoot, renderList: RenderListFn) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      await renderList({ skmtcRoot, projectName })
    })

  return command
}

type RenderListArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderList = async ({
  skmtcRoot,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderListArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'list-generators', projectName },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
