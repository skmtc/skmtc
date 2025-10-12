import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export const description = 'List generators'

export const toListCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
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

      render(<App initialState={initialState} />)
    })

  return command
}
