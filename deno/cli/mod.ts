import { Command } from '@cliffy/command'
import { toInitCommand, renderInit } from './lib/init.tsx'
import { toCreateCommand, renderCreate } from './generators/create.tsx'
import { toInstallCommand, renderInstall } from '@/generators/install.tsx'
import { toRemoveCommand, renderRemove } from '@/generators/remove.tsx'
import { toListCommand, renderList } from '@/generators/list.tsx'
import { toCloneCommand, renderClone } from '@/generators/clone.tsx'
import { toGenerateCommand, renderGenerate } from '@/workspaces/generate.tsx'
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
    .command('init', toInitCommand(skmtcRoot, renderInit))
    .command('create', toCreateCommand(skmtcRoot, renderCreate))
    .command('clone', toCloneCommand(skmtcRoot, renderClone))
    .command('install', toInstallCommand(skmtcRoot, renderInstall))
    .command('list', toListCommand(skmtcRoot, renderList))
    .command('remove', toRemoveCommand(skmtcRoot, renderRemove))
    .command('generate', toGenerateCommand(skmtcRoot, renderGenerate))
    .parse(Deno.args)
}

run()
