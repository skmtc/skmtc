import React from 'react'
import { Command, EnumType } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'

const generatorType = new EnumType(['operation', 'model'])

export const description = 'Create new generator'

export const toCreateCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .type('generator-type', generatorType)
    .arguments('<project:string> <generator:string> <type:generator-type>')
    .action(async (_options, projectName, generator, type) => {
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

      render(<App initialState={initialState} />)
    })

  return command
}
