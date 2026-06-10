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
import { CorePinMismatchError } from '@/lib/generator.ts'

export const description = 'Clone generator'

type RenderCloneArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  generators?: string[]
  jsonFlag?: boolean
  noInputFlag?: boolean
  /**
   * Bypass the pre-flight `@skmtc/core` peer-pin check. Without this
   * flag, clone refuses if the project's core pin doesn't share a
   * major.minor with the CLI's — cloning over a mismatch produces a
   * generator that won't bundle.
   */
  force?: boolean
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
  force,
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
    try {
      const result = await cloneHeadless({ skmtcRoot, projectName, generators, force })
      printCloneResult(result, { format: resolveOutputFormat({ jsonFlag }) })
      Deno.exit(0)
    } catch (error) {
      if (error instanceof CorePinMismatchError) {
        // Peer-pin mismatch is a recipe-shaped failure: there's a
        // specific remediation the operator can execute, so route
        // through the same error path as missing args.
        console.error(
          `Error: @skmtc/core peer-pin mismatch\n\n` +
            `Project pins:  ${error.projectPin}\n` +
            `CLI requires:  ${error.cliCorePin}\n\n` +
            `${error.hint}\n`
        )
        Deno.exit(2)
      }
      throw error
    }
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
        bundle: result.bundle,
        verifyWith: `ls .skmtc/${result.projectName}/`
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(
        `Cloned ${result.cloned.length} generator(s) into "${result.projectName}":`
      )
      for (const { moduleName, version } of result.cloned) {
        console.log(`  - ${moduleName}@${version}`)
      }
      // Surface the post-clone bundle so the operator knows the next
      // `skmtc generate` will pick up the new generator. Without this,
      // friction #4 reappears as "I cloned it but generate produces
      // nothing for it."
      console.log(`\nRebundled: ${result.bundle.bundlePath}`)
      console.log(`Verify with: ls .skmtc/${result.projectName}/`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
