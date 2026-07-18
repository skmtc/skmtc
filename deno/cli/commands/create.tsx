import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import { resolveInputMode } from '@/lib/strict-mode.ts'

export const description = 'Create new generator'

type RenderCreateArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  generator: string
  type: 'operation' | 'model'
  language?: 'typescript' | 'kotlin'
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderCreate = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  generator,
  type,
  language,
  renderFn = render,
  AppComponent = App
}: RenderCreateArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  // Every argument is already on the command line, so a non-TTY caller
  // (agents, CI) gets a headless scaffold instead of the Ink prompts.
  if (resolveInputMode() === 'strict') {
    const project = skmtcRoot.findProject(projectName)

    await project.addGenerator({ moduleName: generator, type, language })

    console.log(`"${generator}" (${type}, ${language ?? 'typescript'}) generator added to ${projectName}`)

    Deno.exit(0)
  }

  const initialState: SkmtcState = {
    view: {
      page: 'create-generator',
      projectName,
      generatorName: generator,
      generatorType: type,
      language
    },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
