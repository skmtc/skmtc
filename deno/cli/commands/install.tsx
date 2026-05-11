import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import { resolveInputMode, failWithRecipe } from '@/lib/strict-mode.ts'
import { installHeadless } from '@/lib/install-headless.ts'

type RenderInstallArgs = {
  skmtcRoot?: SkmtcRoot
  generators: string[] | undefined
  projectName: string | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderInstall = async ({
  skmtcRoot: providedSkmtcRoot,
  generators,
  projectName,
  renderFn = render,
  AppComponent = App
}: RenderInstallArgs) => {
  const mode = resolveInputMode()

  if (mode === 'strict') {
    if (!projectName) {
      failWithRecipe({
        command: 'install',
        arg: '<project>',
        usage: 'skmtc install <generators...> <project>',
        example: 'skmtc install @skmtc/gen-zod @skmtc/gen-tanstack-query my-api',
        discover: 'ls .skmtc/  (list existing projects)'
      })
    }

    if (!generators || generators.length === 0) {
      failWithRecipe({
        command: 'install',
        arg: '<generators...>',
        usage: 'skmtc install <generators...> <project>',
        example: 'skmtc install @skmtc/gen-zod @skmtc/gen-tanstack-query my-api'
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    const result = await installHeadless({
      skmtcRoot,
      projectName: projectName!,
      generators: generators!
    })

    console.log(
      `Installed ${result.installed.length} generator(s) in "${result.projectName}":`
    )
    for (const id of result.installed) {
      console.log(`  - ${id}`)
    }
    console.log(
      `\nVerify with: cat .skmtc/${result.projectName}/deno.json`
    )
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'install-generator', projectName, generators },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
