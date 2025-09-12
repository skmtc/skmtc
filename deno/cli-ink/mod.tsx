import { Command } from '@cliffy/command'
import { toInitCommand } from './lib/init.ts'
import { toLoginCommand, toLogoutCommand } from './auth/auth.ts'
import { toDeployCommand } from './generators/deploy.ts'
import { toAddCommand } from './generators/add.ts'
import { toInstallCommand } from './generators/install.ts'
import { toRemoveCommand } from './generators/remove.ts'
import { toListCommand } from './generators/list.ts'
import { toCloneCommand } from './generators/clone.ts'
import { toGenerateCommand } from './workspaces/generate.ts'
import * as Sentry from '@sentry/node'
import { SkmtcRoot } from './lib/skmtc-root.ts'
import { Manager } from './lib/manager.ts'
import { toRuntimeLogsCommand } from './workspaces/runtime-logs.ts'
import { App } from './components/App.tsx'
import { render } from 'ink'

Sentry.init({
  dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
})

const manager = new Manager()
const skmtcRoot = await SkmtcRoot.open(manager)

await skmtcRoot.upgradeCheck()

render(<App skmtcRoot={skmtcRoot} />)

// await new Command()
//   .description('Generate code from OpenAPI schema')
//   .action(async _flags => {

//   })
//   .command('init', toInitCommand(skmtcRoot))
//   .command('add', toAddCommand(skmtcRoot))
//   .command('clone', toCloneCommand(skmtcRoot))
//   .command('deploy', toDeployCommand(skmtcRoot))
//   .command('install', toInstallCommand(skmtcRoot))
//   .command('list', toListCommand(skmtcRoot))
//   .command('runtime-logs', toRuntimeLogsCommand(skmtcRoot))
//   .command('remove', toRemoveCommand(skmtcRoot))
//   .command('generate', toGenerateCommand(skmtcRoot))
//   .command('login', toLoginCommand(skmtcRoot))
//   .command('logout', toLogoutCommand(skmtcRoot))
//   .parse(Deno.args)
