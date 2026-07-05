import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { bundleHeadless, type BundleHeadlessResult } from '@/lib/bundle-headless.ts'

export const description = 'Create bundle from project'

type RenderBundleArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderBundle = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderBundleArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    return failWithRecipe({
      command: 'bundle',
      arg: '<project>',
      usage: 'skmtc bundle <project>',
      example: 'skmtc bundle my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (mode === 'strict') {
    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = await bundleHeadless({ skmtcRoot, projectName })
    printBundleResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: { page: 'bundle', projectName },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintBundleResultOptions = {
  format: 'text' | 'json'
}

/**
 * Renders the bundle result — a `bundle.js` was written; report the
 * path. Every project (remote-only included) builds a local bundle,
 * so there is no no-op outcome.
 *
 * JSON shape keeps the `type` discriminator — readable for `jq -e
 * '.type == "bundled"'` style scripting.
 */
export const printBundleResult = (
  result: BundleHeadlessResult,
  { format }: PrintBundleResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      console.log(`Bundled "${result.projectName}":`)
      console.log(`  ${result.bundlePath}`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
