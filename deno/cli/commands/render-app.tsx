import type { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

type RenderAppArgs = {
  renderFn: InkRenderFn
  AppComponent: typeof App
  initialState: SkmtcState
}

/**
 * Mounts the Ink App for a command. When the view names a project whose
 * folder did not load, its `ProjectLoadError` is thrown here, before
 * render, so `mod.ts` prints it as one line. Thrown inside render (the App
 * calls `findProject`), Ink would show a stack trace, and the process could
 * exit 0 (#374).
 */
export const renderApp = ({ renderFn, AppComponent, initialState }: RenderAppArgs) => {
  const { view, skmtcRoot } = initialState

  if ('projectName' in view && typeof view.projectName === 'string') {
    skmtcRoot.lookupProject(view.projectName)
  }

  return renderFn(<AppComponent initialState={initialState} />)
}
