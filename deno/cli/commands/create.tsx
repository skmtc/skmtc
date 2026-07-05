import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

export const description = 'Create new generator'

type RenderCreateArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  generator: string
  type: 'operation' | 'model'
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderCreate = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  generator,
  type,
  renderFn = render,
  AppComponent = App
}: RenderCreateArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: {
      page: 'create-generator',
      projectName,
      generatorName: generator,
      generatorType: type
    },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
