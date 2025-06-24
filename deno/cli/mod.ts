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
import {
  toWorkspacesSetCommand,
  toWorkspacesSetPrompt,
  description as workspacesSetDescription
} from './workspaces/set.ts'
import { toGenerateCommand, toGeneratePrompt } from './generators/generate.ts'
import {
  toBaseFilesPushCommand,
  toBaseFilesPushPrompt,
  description as baseFilesPushDescription
} from './base-files/push.ts'
import { hasHome } from './lib/has-home.ts'
import { hasGenerators } from './lib/has-generators.ts'
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
  toUnlinkCommand,
  toUnlinkPrompt,
  description as unlinkDescription
} from './schemas/unlink.ts'
import {
  toWorkspacesGenerateCommand,
  toWorkspacesGeneratePrompt,
  description as workspacesGenerateDescription
} from './workspaces/generate.ts'
import * as Sentry from '@sentry/deno'

Sentry.init({
  dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
})

type PromptResponse =
  | 'init'
  | 'generators:generate'
  | 'generators:add'
  | 'generators:clone'
  | 'generators:install'
  | 'generators:remove'
  | 'generators:deploy'
  | 'login'
  | 'logout'
  | 'schemas:upload'
  | 'schemas:unlink'
  | 'project-create'
  | 'workspaces:info'
  | 'workspaces:set'
  | 'workspaces:generate'
  | 'base-files:push'
  | 'exit'

const getOptions = async () => {
  const homeExists = hasHome()
  const generatorsExist = await hasGenerators()

  if (!homeExists) {
    return [
      { name: 'Create new API Foundry project', value: 'init' },
      { name: 'Log in to Codesquared', value: 'login' },
      { name: 'Log out', value: 'logout' },
      { name: 'Exit', value: 'exit' }
    ]
  }

  if (!generatorsExist) {
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
      {
        name: workspacesSetDescription,
        value: 'workspaces:set'
      },
      Select.separator(' - Schemas - '),
      {
        name: unlinkDescription,
        value: 'schemas:unlink'
      },
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
      name: workspacesSetDescription,
      value: 'workspaces:set'
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
      name: unlinkDescription,
      value: 'schemas:unlink'
    },
    {
      name: uploadDescription,
      value: 'schemas:upload'
    },
    { name: 'Exit', value: 'exit' }
  ]
}

const promptwise = async () => {
  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to smktc! What would you like to do?',
    options: await getOptions()
  })

  await match(action)
    .with('init', async () => await toInitPrompt())
    .with('base-files:push', async () => await toBaseFilesPushPrompt())
    .with('generators:add', async () => await toAddPrompt())
    .with('generators:clone', async () => await toClonePrompt())
    .with('generators:deploy', async () => await toDeployPrompt())
    .with('generators:generate', async () => await toGeneratePrompt())
    .with('generators:install', async () => await toInstallPrompt())
    .with('generators:remove', async () => await toRemovePrompt())
    .with('schemas:unlink', async () => await toUnlinkPrompt())
    .with('schemas:upload', async () => await toUploadPrompt())
    .with('workspaces:generate', async () => await toWorkspacesGeneratePrompt())
    .with('workspaces:info', async () => await toWorkspacesInfoPrompt())
    .with('workspaces:set', async () => await toWorkspacesSetPrompt())
    .with('login', async () => await toLoginPrompt())
    .with('logout', async () => await toLogoutPrompt())
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
  .command('init', toInitCommand())
  .command('base-files:push', toBaseFilesPushCommand())
  .command('generators:add', toAddCommand())
  .command('generators:clone', toCloneCommand())
  .command('generators:deploy', toDeployCommand())
  .command('generators:generate', toGenerateCommand())
  .command('generators:install', toInstallCommand())
  .command('generators:remove', toRemoveCommand())
  .command('schemas:unlink', toUnlinkCommand())
  .command('schemas:upload', toUploadCommand())
  .command('workspaces:generate', toWorkspacesGenerateCommand())
  .command('workspaces:info', toWorkspacesInfoCommand())
  .command('workspaces:set', toWorkspacesSetCommand())
  .command('login', toLoginCommand())
  .command('logout', toLogoutCommand())
  .parse(Deno.args)
