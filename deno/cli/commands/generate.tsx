import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { formatNumber } from '@skmtc/core/formatNumber'
import type { GenerationStats } from '@/lib/generationStats.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'

type RenderGenerateArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderGenerate = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  schemaSourceString,
  watch,
  renderFn = render,
  AppComponent = App
}: RenderGenerateArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.findProject(projectName)

  // The Ink view builds the bundle first, then generates.
  const initialState: SkmtcState = {
    view: {
      page: 'generate',
      project,
      schemaSourceString,
      watchMode: Boolean(watch)
    },
    skmtcRoot,
    message: null,
    interactive: true,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

export const toGenerateMessage = (stats: GenerationStats): SuccessMessage => {
  const { files, tokens, totalTime, errors } = stats

  const success = `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`

  return errors.length
    ? {
        success,
        sub: `${formatNumber(errors.length)} errors detected - view runtime logs for details`
      }
    : { success }
}
