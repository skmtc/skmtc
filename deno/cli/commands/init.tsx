import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import { resolveInputMode, failWithRecipe } from '@/lib/strict-mode.ts'

type RenderInitArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
}

export const renderInit = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  basePath,
  renderFn = render,
  AppComponent = App
}: RenderInitArgs) => {
  const mode = resolveInputMode()

  if (mode === 'strict') {
    if (!projectName) {
      failWithRecipe({
        command: 'init',
        arg: '<projectName>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src'
      })
    }

    if (!basePath) {
      failWithRecipe({
        command: 'init',
        arg: '<basePath>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src',
        discover: 'basePath is the consuming app source root relative to the SKMTC root (the directory containing .skmtc/). Absolute paths are not allowed.'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    const existing = skmtcRoot.projects.find(p => p.name === projectName)
    if (existing) {
      console.log(`Project "${projectName!}" already exists at .skmtc/${projectName!}/ — nothing to do.`)
      Deno.exit(0)
    }

    await skmtcRoot.createProject({
      name: projectName!,
      basePath: basePath!,
      generators: [],
      availableGenerators: []
    })

    console.log(`Initialized project "${projectName!}" at .skmtc/${projectName!}/`)
    console.log(`  basePath: ${basePath!}`)
    console.log(`\nNext: skmtc install <generators...> ${projectName!}`)
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'create-project', projectName, basePath },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
