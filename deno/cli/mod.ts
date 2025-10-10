import { Command } from '@cliffy/command'
import { toInitCommand } from './lib/init.tsx'
import { toCreateCommand } from './generators/create.tsx'
import { toInstallCommand } from '@/generators/install.tsx'
import { toRemoveCommand } from '@/generators/remove.tsx'
import { toListCommand } from '@/generators/list.tsx'
import { toCloneCommand } from '@/generators/clone.tsx'
import { toGenerateCommand } from '@/workspaces/generate.tsx'
import * as Sentry from '@sentry/node'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { runPrompt } from '@/prompt/run-prompt.tsx'

Sentry.init({
  dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
})

const run = async () => {
  const manager = new Manager()
  const skmtcRoot = await SkmtcRoot.open(manager)

  // await skmtcRoot.upgradeCheck()

  await new Command()
    .description('Generate code from OpenAPI schema')
    .action(async _flags => {
      await runPrompt(skmtcRoot)
    })
    .command('init', toInitCommand(skmtcRoot))
    .command('create', toCreateCommand(skmtcRoot))
    .command('clone', toCloneCommand(skmtcRoot))
    .command('install', toInstallCommand(skmtcRoot))
    .command('list', toListCommand(skmtcRoot))
    .command('remove', toRemoveCommand(skmtcRoot))
    .command('generate', toGenerateCommand(skmtcRoot))
    .parse(Deno.args)
}

run()
