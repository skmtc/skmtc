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
import { cloneHeadless, type CloneHeadlessResult } from '@/lib/clone-headless.ts'

export const description = 'Clone generator'

type RenderCloneArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  generators?: string[]
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderClone = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  generators,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderCloneArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (projectName === undefined) {
    return failWithRecipe({
      command: 'clone',
      arg: '<project>',
      usage: 'skmtc clone <project> --generator <id>... [--generator <id>...]',
      example:
        'skmtc clone my-api --generator @skmtc/gen-typescript --generator @skmtc/gen-zod',
      discover: 'ls .skmtc/  (list existing projects)'
    })
  }

  if (mode === 'strict') {
    if (generators === undefined || generators.length === 0) {
      // Strict mode requires the generator set up front — the Ink
      // MultiSelect picker only runs in interactive mode (friction #25).
      return failWithRecipe({
        command: 'clone',
        arg: '--generator',
        usage: 'skmtc clone <project> --generator <id> [--generator <id>...]',
        example:
          'skmtc clone my-api --generator @skmtc/gen-typescript --generator @skmtc/gen-zod',
        discover:
          'skmtc list <project>  (shows installed generators that can be cloned locally)'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
    const result = await cloneHeadless({ skmtcRoot, projectName, generators })
    printCloneResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'clone-generator', projectName },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintCloneResultOptions = {
  format: 'text' | 'json'
}

/**
 * Formats a {@link CloneHeadlessResult} to stdout. The structured form
 * mirrors what `install` returns — same shape, same `verifyWith`
 * convention — so agents only have to learn one mutation-result shape.
 */
export const printCloneResult = (
  result: CloneHeadlessResult,
  { format }: PrintCloneResultOptions
): void => {
  switch (format) {
    case 'json': {
      const payload = {
        projectName: result.projectName,
        cloned: result.cloned,
        verifyWith: `ls .skmtc/${result.projectName}/`
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(
        `Cloned ${result.cloned.length} generator(s) into "${result.projectName}":`
      )
      for (const id of result.cloned) {
        console.log(`  - ${id}`)
      }
      console.log(`\nVerify with: ls .skmtc/${result.projectName}/`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
