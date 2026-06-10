import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import {
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import {
  initHeadless,
  InvalidBasePathError,
  type InitHeadlessResult
} from '@/lib/init-headless.ts'

type RenderInitArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
}

export const renderInit = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  basePath,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderInitArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (mode === 'strict') {
    if (projectName === undefined) {
      return failWithRecipe({
        command: 'init',
        arg: '<projectName>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src'
      })
    }

    if (basePath === undefined) {
      return failWithRecipe({
        command: 'init',
        arg: '<basePath>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src',
        discover:
          'basePath is relative to the SKMTC root (the directory containing .skmtc/). It must also equal what the `@` alias resolves to in your consumer app\'s bundler, since generators emit `@/<subdir>/...` paths.'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    let result: InitHeadlessResult
    try {
      result = await initHeadless({ skmtcRoot, projectName, basePath })
    } catch (error) {
      if (error instanceof InvalidBasePathError) {
        return failWithRecipe({
          command: 'init',
          arg: '<basePath>',
          usage: 'skmtc init <projectName> <basePath>',
          example: 'skmtc init my-api ./web/app/src',
          discover: error.message
        })
      }
      throw error
    }

    printInitResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: { page: 'create-project', projectName, basePath },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintInitResultOptions = {
  format: 'text' | 'json'
}

export const printInitResult = (
  result: InitHeadlessResult,
  { format }: PrintInitResultOptions
): void => {
  switch (format) {
    case 'json': {
      // Augment the result with a `nextStep` so an agent always knows
      // what to do next — same pattern as install's `verifyWith`.
      const payload = {
        ...result,
        nextStep:
          result.kind === 'created'
            ? `skmtc install <generators...> ${result.projectName}`
            : null
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      switch (result.kind) {
        case 'created': {
          console.log(`Initialized project "${result.projectName}" at .skmtc/${result.projectName}/`)
          console.log(`  basePath: ${result.basePath}`)
          console.log(`\nNext: skmtc install <generators...> ${result.projectName}`)
          return
        }
        case 'existed': {
          console.log(
            `Project "${result.projectName}" already exists at .skmtc/${result.projectName}/ — nothing to do.`
          )
          return
        }
        default: {
          const _exhaustive: never = result
          throw new Error(`Unhandled init result: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
