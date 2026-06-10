import React from 'react'
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
import { removeHeadless, type RemoveHeadlessResult } from '@/lib/remove-headless.ts'

type RenderRemoveArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  generator: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderRemove = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  generator,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderRemoveArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    return failWithRecipe({
      command: 'remove',
      arg: '<project>',
      usage: 'skmtc remove <project> <generator>',
      example: 'skmtc remove my-api @skmtc/gen-zod',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (generator === undefined) {
    return failWithRecipe({
      command: 'remove',
      arg: '<generator>',
      usage: 'skmtc remove <project> <generator>',
      example: 'skmtc remove my-api @skmtc/gen-zod',
      discover: `skmtc list ${projectName}  (lists installed generators)`
    })
  }

  if (mode === 'strict') {
    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = await removeHeadless({ skmtcRoot, projectName, generator })
    printRemoveResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: { page: 'remove-generator', projectName, generatorName: generator },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintRemoveResultOptions = {
  format: 'text' | 'json'
}

export const printRemoveResult = (
  result: RemoveHeadlessResult,
  { format }: PrintRemoveResultOptions
): void => {
  switch (format) {
    case 'json': {
      const payload = {
        projectName: result.projectName,
        removed: result.removed,
        verifyWith: `cat .skmtc/${result.projectName}/deno.json`
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(`Removed "${result.removed}" from "${result.projectName}".`)
      console.log(`\nVerify with: cat .skmtc/${result.projectName}/deno.json`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
