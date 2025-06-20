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
  toWorkspacesSetCommand,
  toWorkspacesSetPrompt,
  toWorkspacesGetCommand,
  toWorkspacesGetPrompt
} from './src/workspaces/workspaces.ts'
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

type InitAction = {
  action: 'init'
}

type LoginAction = {
  action: 'login'
}

type LogoutAction = {
  action: 'logout'
}

type SchemasUploadAction = {
  action: 'schemas:upload'
}

type ProjectCreateAction = {
  action: 'project-create'
}

type GeneratorsAddAction = {
  action: 'generators:add'
}

type GeneratorsCloneAction = {
  action: 'generators:clone'
}

type GeneratorsInstallAction = {
  action: 'generators:install'
}

type GeneratorsRemoveAction = {
  action: 'generators:remove'
}

type GeneratorsGenerateAction = {
  action: 'generators:generate'
}

type GeneratorsDeployAction = {
  action: 'generators:deploy'
}

type WorkspaceGetAction = {
  action: 'workspace:get'
}

type WorkspaceSetAction = {
  action: 'workspace:set'
}

type BaseImagePullAction = {
  action: 'base-image:pull'
}

type BaseImagePushAction = {
  action: 'base-image:push'
}

type ExitAction = {
  action: 'exit'
}

type PromptResponse =
  | InitAction
  | GeneratorsGenerateAction
  | GeneratorsAddAction
  | GeneratorsCloneAction
  | GeneratorsInstallAction
  | GeneratorsRemoveAction
  | GeneratorsDeployAction
  | LoginAction
  | LogoutAction
  | SchemasUploadAction
  | ProjectCreateAction
  | WorkspaceGetAction
  | WorkspaceSetAction
  | BaseImagePullAction
  | BaseImagePushAction
  | ExitAction

const getOptions = async () => {
  const homeExists = await hasHome()
  const generatorsExist = await hasGenerators()

  if (!homeExists) {
    return [
      { name: 'Create new API Foundry project', action: 'init' },
      { name: 'Log in to Codesquared', action: 'login' },
      { name: 'Log out', action: 'logout' },
      { name: 'Exit', action: 'exit' }
    ]
  }

  if (!generatorsExist) {
    return [
      {
        name: cloneDescription,
        action: 'generators:clone'
      },
      {
        name: addDescription,
        action: 'generators:add'
      },
      {
        name: installDescription,
        action: 'generators:install'
      },
      {
        name: uploadDescription,
        action: 'schemas:upload'
      },
      { name: 'Add a new schema from url', action: 'add' },
      { name: 'Exit', action: 'exit' }
    ]
  }

  return [
    { name: 'Run code generator', action: 'generate' },
    {
      name: cloneDescription,
      action: 'generators:clone'
    },
    {
      name: addDescription,
      action: 'generators:add'
    },
    {
      name: installDescription,
      action: 'generators:install'
    },
    {
      name: removeDescription,
      action: 'generators:remove'
    },
    {
      name: deployDescription,
      action: 'generators:deploy'
    },
    { name: 'Exit', action: 'exit' }
  ]
}

const promptwise = async () => {
  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to smktc! What would you like to do?',
    options: await getOptions()
  })

  await match(action)
    .with({ action: 'init' }, async () => await toInitPrompt())
    .with({ action: 'workspace:set' }, async () => await toWorkspacesSetPrompt())
    .with({ action: 'workspace:get' }, async () => await toWorkspacesGetPrompt())
    .with({ action: 'base-image:pull' }, async () => await toBaseImagePullPrompt())
    .with({ action: 'base-image:push' }, async () => await toBaseImagePushPrompt())
    .with({ action: 'generators:clone' }, async () => await toClonePrompt())
    .with({ action: 'generators:add' }, async () => await toAddPrompt())
    .with({ action: 'generators:install' }, async () => await toInstallPrompt())
    .with({ action: 'generators:remove' }, async () => await toRemovePrompt())
    .with({ action: 'generators:generate' }, async () => await toGeneratePrompt())
    .with({ action: 'generators:deploy' }, async () => await toDeployPrompt())
    .with({ action: 'schemas:upload' }, async () => await toUploadPrompt())
    .with({ action: 'login' }, async () => await toLoginPrompt())
    .with({ action: 'logout' }, async () => await toLogoutPrompt())
    .with({ action: 'exit' }, () => Deno.exit(0))
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
