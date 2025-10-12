import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export const description = 'Remove generator'

export const toRemoveCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action(async (_options, projectName, generator) => {
      const session = await skmtcRoot.manager.auth.toSession()

      const initialState: SkmtcState = {
        view: { page: 'remove-generator', projectName, generatorName: generator },
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
