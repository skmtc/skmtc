import { Command, EnumType } from '@cliffy/command'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

const generatorType = new EnumType(['operation', 'model'])

export const description = 'Create new generator'

export const toAddCommand = (skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .type('generator-type', generatorType)
    .arguments('<project:string> <generator:string> <type:generator-type>')
    .action(async (_options, projectName, generator, type) => {
      const session = await skmtcRoot.manager.auth.toSession()

      render(
        <App
          skmtcRoot={skmtcRoot}
          session={session}
          view={{
            page: 'add-generator',
            projectName,
            generatorName: generator,
            generatorType: type
          }}
          interactive={false}
        />
      )
    })

  return command
}
