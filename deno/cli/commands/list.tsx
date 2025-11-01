import React from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { SkmtcRoot as SkmtcRootClass } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

type RenderListArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderList = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderListArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const manager = new Manager()
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRootClass.open(manager))

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
