import { Command } from '@cliffy/command'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '../components/App.tsx'

export const description = 'Deploy generators'

export const toDeployCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string>')
    .action(async (_options, projectName) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{ page: 'deploy', projectName }}
          interactive={false}
        />
      )
    })
}
