import React from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { SkmtcRoot as SkmtcRootClass } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

type RenderInitArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
}

export const renderInit = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  basePath,
  renderFn = render,
  AppComponent = App
}: RenderInitArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const manager = new Manager()
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRootClass.open(manager))

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
