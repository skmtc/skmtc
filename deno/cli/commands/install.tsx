import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

type RenderInstallArgs = {
  skmtcRoot?: SkmtcRoot
  generators: string[] | undefined
  projectName: string | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderInstall = async ({
  skmtcRoot: providedSkmtcRoot,
  generators,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderInstallArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

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
