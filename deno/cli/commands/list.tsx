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
import { listHeadless, type ListHeadlessResult } from '@/lib/list-headless.ts'

type RenderListArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderList = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderListArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    // `list` has no Ink view for picking a project — the next-frame
    // would be `ListGeneratorsView` which already requires
    // `projectName: string`. So the recipe error is appropriate in
    // both modes; we just print it and exit instead of crashing the
    // Ink render with a non-null assertion failure later.
    //
    // `return failWithRecipe(...)` so TS sees the `never` return type
    // through control-flow analysis and narrows `projectName` to
    // `string` for the rest of the function.
    return failWithRecipe({
      command: 'list',
      arg: '<project>',
      usage: 'skmtc list <project>',
      example: 'skmtc list my-api',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (mode === 'strict') {
    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = listHeadless({ skmtcRoot, projectName })
    printListResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'list-generators', projectName },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintListResultOptions = {
  format: 'text' | 'json'
}

/**
 * Renders a {@link ListHeadlessResult} to stdout. The text form mirrors
 * the Ink `ListGeneratorsView` layout (header + bulleted ids, dim
 * "No generators found" when the project is empty) so operators get
 * the same shape whether they're in a TTY or piping through `jq`.
 *
 * Exported for the test suite so we don't have to capture stdout.
 */
export const printListResult = (
  result: ListHeadlessResult,
  { format }: PrintListResultOptions
): void => {
  switch (format) {
    case 'json': {
      console.log(JSON.stringify(result, null, 2))
      return
    }
    case 'text': {
      console.log(`Generators in ${result.projectName}:`)
      if (result.generators.length === 0) {
        console.log('  (none)')
        return
      }
      for (const id of result.generators) {
        console.log(`  - ${id}`)
      }
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
