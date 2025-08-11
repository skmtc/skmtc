import { Command } from '@cliffy/command'
import { toInitPrompt, toInitCommand } from './lib/init.ts'
import { Select } from '@cliffy/prompt'
import { match } from 'ts-pattern'
import { toLoginCommand, toLogoutCommand, toLoginPrompt, toLogoutPrompt } from './auth/auth.ts'
import {
  toDeployCommand,
  toDeployPrompt,
  description as deployDescription
} from './generators/deploy.ts'
import {
  toUploadCommand,
  toUploadPrompt,
  description as uploadDescription
} from './schemas/upload.ts'
import {
  toWorkspacesInfoCommand,
  toWorkspacesInfoPrompt,
  description as workspacesInfoDescription
} from './workspaces/info.ts'
import { toGenerateCommand, toGeneratePrompt } from './generators/generate.ts'
import {
  toBaseFilesPushCommand,
  toBaseFilesPushPrompt,
  description as baseFilesPushDescription
} from './base-files/push.ts'
import { toAddCommand, toAddPrompt, description as addDescription } from './generators/add.ts'
import {
  toInstallCommand,
  toInstallPrompt,
  description as installDescription
} from './generators/install.ts'
import {
  toRemoveCommand,
  toRemovePrompt,
  description as removeDescription
} from './generators/remove.ts'
import {
  toCloneCommand,
  toClonePrompt,
  description as cloneDescription
} from './generators/clone.ts'
import {
  toWorkspacesGenerateCommand,
  toWorkspacesGeneratePrompt,
  description as workspacesGenerateDescription
} from './workspaces/generate.ts'
import * as Sentry from '@sentry/deno'
import {
  toWorkspacesMessageCommand,
  toWorkspacesMessagePrompt,
  description as workspacesMessageDescription
} from './workspaces/message.ts'
import { SkmtcRoot } from './lib/skmtc-root.ts'
import { Manager } from './lib/manager.ts'

Sentry.init({
  dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
})

const kv = await Deno.openKv()

const manager = new Manager({ kv })
const skmtcRoot = await SkmtcRoot.open(manager)

type PromptResponse =
  | 'init'
  | 'base-files:push'
  | 'generators:add'
  | 'generators:clone'
  | 'generators:deploy'
  | 'generators:generate'
  | 'generators:install'
  | 'generators:remove'
  | 'login'
  | 'logout'
  | 'project-create'
  | 'schemas:info'
  | 'schemas:link'
  | 'schemas:unlink'
  | 'schemas:upload'
  | 'workspaces:generate'
  | 'workspaces:info'
  | 'workspaces:link'
  | 'workspaces:message'
  | 'exit'

const getOptions = async () => {
  if (skmtcRoot.projects.length === 0) {
    return [
      { name: 'Create new Skmtc project', value: 'init' },
      { name: 'Log in to Skmtc', value: 'login' },
      { name: 'Log out', value: 'logout' },
      { name: 'Exit', value: 'exit' }
    ]
  }

  // TODO: Add project selection
  if (skmtcRoot.projects.length > 0) {
    return [
      Select.separator(' - Generators - '),
      {
        name: addDescription,
        value: 'generators:add'
      },
      {
        name: installDescription,
        value: 'generators:install'
      },
      {
        name: cloneDescription,
        value: 'generators:clone'
      },
      Select.separator(' - Base Files - '),
      {
        name: baseFilesPushDescription,
        value: 'base-files:push'
      },
      Select.separator(' - Workspaces - '),
      {
        name: workspacesInfoDescription,
        value: 'workspaces:info'
      },
      Select.separator(' - Schemas - '),
      {
        name: uploadDescription,
        value: 'schemas:upload'
      },
      { name: 'Exit', value: 'exit' }
    ]
  }

  return [
    Select.separator(' - Generators - '),
    {
      name: addDescription,
      value: 'generators:add'
    },
    {
      name: installDescription,
      value: 'generators:install'
    },
    {
      name: cloneDescription,
      value: 'generators:clone'
    },
    {
      name: removeDescription,
      value: 'generators:remove'
    },
    {
      name: deployDescription,
      value: 'generators:deploy'
    },
    Select.separator(' - Workspaces - '),
    {
      name: workspacesInfoDescription,
      value: 'workspaces:info'
    },
    {
      name: workspacesMessageDescription,
      value: 'workspaces:message'
    },
    {
      name: workspacesGenerateDescription,
      value: 'workspaces:generate'
    },
    Select.separator(' - Base Files - '),
    {
      name: baseFilesPushDescription,
      value: 'base-files:push'
    },
    Select.separator(' - Schemas - '),
    {
      name: uploadDescription,
      value: 'schemas:upload'
    },
    { name: 'Exit', value: 'exit' }
  ]
}

const promptwise = async () => {
  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to Smktc! What would you like to do?',
    options: await getOptions()
  })

  await match(action)
    .with('init', async () => await toInitPrompt(skmtcRoot))
    .with('base-files:push', async () => await toBaseFilesPushPrompt(skmtcRoot))
    .with('generators:add', async () => await toAddPrompt(skmtcRoot))
    .with('generators:clone', async () => await toClonePrompt(skmtcRoot))
    .with('generators:deploy', async () => await toDeployPrompt(skmtcRoot))
    .with('generators:generate', async () => await toGeneratePrompt())
    .with('generators:install', async () => await toInstallPrompt(skmtcRoot))
    .with('generators:remove', async () => await toRemovePrompt(skmtcRoot))
    .with('schemas:upload', async () => await toUploadPrompt(skmtcRoot))
    .with('workspaces:generate', async () => await toWorkspacesGeneratePrompt(skmtcRoot))
    .with('workspaces:info', async () => await toWorkspacesInfoPrompt(skmtcRoot))
    .with('workspaces:message', async () => await toWorkspacesMessagePrompt(skmtcRoot))
    .with('login', async () => await toLoginPrompt(skmtcRoot))
    .with('logout', async () => await toLogoutPrompt(skmtcRoot))
    .with('exit', () => Deno.exit(0))
    .otherwise(matched => {
      console.log('matched', JSON.stringify(matched, null, 2))

      throw new Error(`Invalid action: ${matched}`)
    })

  setTimeout(promptwise, 0)
}

await new Command()
  .description('Generate code from OpenAPI schema')
  .action(async _flags => {
    await promptwise()
  })
  .command('init', toInitCommand(skmtcRoot))
  .command('base-files:push', await toBaseFilesPushCommand(skmtcRoot))
  .command('generators:add', toAddCommand(skmtcRoot))
  .command('generators:clone', toCloneCommand(skmtcRoot))
  .command('generators:deploy', toDeployCommand(skmtcRoot))
  .command('generators:generate', toGenerateCommand())
  .command('generators:install', toInstallCommand(skmtcRoot))
  .command('generators:remove', toRemoveCommand(skmtcRoot))
  .command('schemas:upload', toUploadCommand(skmtcRoot))
  .command('workspaces:generate', toWorkspacesGenerateCommand(skmtcRoot))
  .command('workspaces:info', toWorkspacesInfoCommand(skmtcRoot))
  .command('workspaces:message', toWorkspacesMessageCommand(skmtcRoot))
  .command('login', toLoginCommand(skmtcRoot))
  .command('logout', toLogoutCommand(skmtcRoot))
  .parse(Deno.args)
