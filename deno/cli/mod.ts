import { Command } from '@cliffy/command'
import { toInitPrompt, toInitCommand } from './src/init.ts'
import { Select } from '@cliffy/prompt'
import { match } from 'ts-pattern'
import { toLoginCommand, toLogoutCommand, toLoginPrompt, toLogoutPrompt } from './src/auth/auth.ts'
import {
  toDeployCommand,
  toDeployPrompt,
  description as deployDescription
} from './src/generators/deploy.ts'
import {
  toUploadCommand,
  toUploadPrompt,
  description as uploadDescription
} from './src/schemas/upload.ts'
import {
  toWorkspacesGetCommand,
  toWorkspacesGetPrompt,
  description as workspacesGetDescription
} from './src/workspaces/get.ts'
import {
  toWorkspacesSetCommand,
  toWorkspacesSetPrompt,
  description as workspacesSetDescription
} from './src/workspaces/set.ts'
import { toGenerateCommand, toGeneratePrompt } from './src/generators/generate.ts'
import {
  toBaseImagePullCommand,
  toBaseImagePullPrompt,
  toBaseImagePushCommand,
  toBaseImagePushPrompt
} from './src/base-image/base-image.ts'
import { hasHome } from './src/lib/has-home.ts'
import { hasGenerators } from './src/lib/has-generators.ts'
import { toAddCommand, toAddPrompt, description as addDescription } from './src/generators/add.ts'
import {
  toInstallCommand,
  toInstallPrompt,
  description as installDescription
} from './src/generators/install.ts'
import {
  toRemoveCommand,
  toRemovePrompt,
  description as removeDescription
} from './src/generators/remove.ts'
import {
  toCloneCommand,
  toClonePrompt,
  description as cloneDescription
} from './src/generators/clone.ts'

import * as Sentry from 'npm:@sentry/deno'

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
  | 'project-create'
  | 'workspaces:get'
  | 'workspaces:set'
  | 'base-image:pull'
  | 'base-image:push'
  | 'exit'

const getOptions = async () => {
  const homeExists = await hasHome()
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
      {
        name: cloneDescription,
        value: 'generators:clone'
      },
      {
        name: addDescription,
        value: 'generators:add'
      },
      {
        name: installDescription,
        value: 'generators:install'
      },
      {
        name: uploadDescription,
        value: 'schemas:upload'
      },
      { name: 'Add a new schema from url', value: 'add' },
      { name: 'Exit', value: 'exit' }
    ]
  }

  return [
    { name: 'Run code generator', value: 'generate' },
    {
      name: cloneDescription,
      value: 'generators:clone'
    },
    {
      name: addDescription,
      value: 'generators:add'
    },
    {
      name: installDescription,
      value: 'generators:install'
    },
    {
      name: removeDescription,
      value: 'generators:remove'
    },
    {
      name: deployDescription,
      value: 'generators:deploy'
    },
    {
      name: workspacesGetDescription,
      value: 'workspaces:get'
    },
    {
      name: workspacesSetDescription,
      value: 'workspaces:set'
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
    .with('workspaces:set', async () => await toWorkspacesSetPrompt())
    .with('workspaces:get', async () => await toWorkspacesGetPrompt())
    .with('base-image:pull', async () => await toBaseImagePullPrompt())
    .with('base-image:push', async () => await toBaseImagePushPrompt())
    .with('generators:clone', async () => await toClonePrompt())
    .with('generators:add', async () => await toAddPrompt())
    .with('generators:install', async () => await toInstallPrompt())
    .with('generators:remove', async () => await toRemovePrompt())
    .with('generators:generate', async () => await toGeneratePrompt())
    .with('generators:deploy', async () => await toDeployPrompt())
    .with('schemas:upload', async () => await toUploadPrompt())
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
  .command('workspace:set', toWorkspacesSetCommand())
  .command('workspace:get', toWorkspacesGetCommand())
  .command('base-image:pull', toBaseImagePullCommand())
  .command('base-image:push', toBaseImagePushCommand())
  .command('generators:clone', toCloneCommand())
  .command('generators:add', toAddCommand())
  .command('generators:install', toInstallCommand())
  .command('generators:remove', toRemoveCommand())
  .command('generators:generate', toGenerateCommand())
  .command('generators:deploy', toDeployCommand())
  .command('schemas:upload', toUploadCommand())
  .command('login', toLoginCommand())
  .command('logout', toLogoutCommand())
  .parse(Deno.args)
