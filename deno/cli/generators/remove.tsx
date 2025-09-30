import React from 'react'
import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

export const description = 'Remove generator'

export const toRemoveCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .arguments('<project:string> <generator:string>')
    .action(async (_options, projectName, generator) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{
            page: 'remove-generator',
            projectName,
            generatorName: generator
          }}
          interactive={false}
        />
      )
    })

  return command
}
