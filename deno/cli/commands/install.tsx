import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { installHeadless, type InstallHeadlessResult } from '@/lib/install-headless.ts'

type RenderInstallArgs = {
  skmtcRoot?: SkmtcRoot
  generators: string[] | undefined
  projectName: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderInstall = async ({
  skmtcRoot: providedSkmtcRoot,
  generators,
  projectName,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderInstallArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (mode === 'strict') {
    if (projectName === undefined) {
      return failWithRecipe({
        command: 'install',
        arg: '<project>',
        usage: 'skmtc install <generators...> <project>',
        example: 'skmtc install @skmtc/gen-zod @skmtc/gen-tanstack-query my-api',
        discover: 'ls .skmtc/  (list existing projects)'
      })
    }

    if (generators === undefined || generators.length === 0) {
      return failWithRecipe({
        command: 'install',
        arg: '<generators...>',
        usage: 'skmtc install <generators...> <project>',
        example: 'skmtc install @skmtc/gen-zod @skmtc/gen-tanstack-query my-api'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    const result = await installHeadless({
      skmtcRoot,
      projectName,
      generators
    })

    printInstallResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: { page: 'install-generator', projectName, generators },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintInstallResultOptions = {
  format: 'text' | 'json'
}

/**
 * Formats an {@link InstallHeadlessResult} to stdout. Text matches the
 * prior install summary; JSON is the same shape the headless layer
 * returns. Both modes report installed generators plus a `verifyWith`
 * hint so the operator (or agent) can confirm `deno.json` was actually
 * updated — friction #2 made silent install failures invisible, so the
 * hint is now part of every successful run too.
 */
export const printInstallResult = (
  result: InstallHeadlessResult,
  { format }: PrintInstallResultOptions
): void => {
  switch (format) {
    case 'json': {
      const payload = {
        projectName: result.projectName,
        installed: result.installed,
        bundle: result.bundle,
        verifyWith: `cat .skmtc/${result.projectName}/deno.json`
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(
        `Installed ${result.installed.length} generator(s) in "${result.projectName}":`
      )
      for (const id of result.installed) {
        console.log(`  - ${id}`)
      }
      // The post-install rebundle picks up the new generator so the
      // next `skmtc generate` runs it — remote-only and hybrid alike.
      console.log(`\nRebundled: ${result.bundle.bundlePath}`)
      console.log(`Verify with: cat .skmtc/${result.projectName}/deno.json`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
