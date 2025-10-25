import React from 'react'
import { Command, EnumType } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/lib/init.tsx'

const generatorType = new EnumType(['operation', 'model'])

export const description = 'Create new generator'

type RenderCreateFn = (args: RenderCreateArgs) => Promise<void>

export const toCreateCommand = (skmtcRoot: SkmtcRoot, renderCreate: RenderCreateFn) => {
  const command = new Command()
    .description(description)
    .type('generator-type', generatorType)
    .arguments('<project:string> <generator:string> <type:generator-type>')
    .action(async (_options, projectName, generator, type) => {
      await renderCreate({ skmtcRoot, projectName, generator, type })
    })

  return command
}

type RenderCreateArgs = {
  skmtcRoot: SkmtcRoot
  projectName: string
  generator: string
  type: 'operation' | 'model'
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderCreate = async ({
  skmtcRoot,
  projectName,
  generator,
  type,
  renderFn = render,
  AppComponent = App
}: RenderCreateArgs) => {
  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: {
      page: 'create-generator',
      projectName,
      generatorName: generator,
      generatorType: type
    },
    skmtcRoot,
    session,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}
