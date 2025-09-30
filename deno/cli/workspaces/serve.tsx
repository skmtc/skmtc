import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

export const description = 'Run project server locally'

export const toServeCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [port:string]')
    .action(async (_args, projectName, port) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{ page: 'serve', projectName, port }}
          interactive={false}
        />
      )
    })
}
