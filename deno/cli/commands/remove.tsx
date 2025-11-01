import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

type RenderRemoveArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  generator: string
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderRemove = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  generator,
  renderFn = render,
  AppComponent = App
}: RenderRemoveArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

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
