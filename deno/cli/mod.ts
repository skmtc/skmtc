import { Command } from '@cliffy/command'
import { generatePrompt, generateCommand } from './src/setupGenerate.ts'
import { toInitPrompt, toInitCommand } from './src/init.ts'
import { toClonePrompt, toCloneCommand } from './src/generators/clone.ts'
import { toAddPrompt, toAddCommand } from './src/add.ts'
import { Select } from '@cliffy/prompt'
import { match } from 'ts-pattern'
import { toLoginCommand, toLogoutCommand, toLoginPrompt, toLogoutPrompt } from './src/auth/auth.ts'
import { toDeployCommand, toDeployPrompt } from './src/deploy/deploy.ts'
import { toUploadCommand, toUploadPrompt } from './src/upload/upload.ts'
import {
  toWorkspacesSetCommand,
  toWorkspacesSetPrompt,
  toWorkspacesGetCommand,
  toWorkspacesGetPrompt
} from './src/workspaces/workspaces.ts'
import { toArtifactsCommand, toArtifactsPrompt } from './src/artifacts/artifacts.ts'
import {
  toBaseImagePullCommand,
  toBaseImagePullPrompt,
  toBaseImagePushCommand,
  toBaseImagePushPrompt
} from './src/base-image/base-image.ts'
import { hasHome } from './src/lib/has-home.ts'
import { hasGenerators } from './src/lib/has-generators.ts'

type InitAction = {
  action: 'init'
  options?: {
    includeDemo?: 'hello-world' | 'petstore'
  }
}

type GenerateAction = {
  action: 'generate'
}

type CloneAction = {
  action: 'clone'
}

type AddAction = {
  action: 'add'
}

type LoginAction = {
  action: 'login'
}

type LogoutAction = {
  action: 'logout'
}

type DeployAction = {
  action: 'deploy'
}

type UploadAction = {
  action: 'upload'
}

type ArtifactsAction = {
  action: 'artifacts'
}

type ProjectCreateAction = {
  action: 'project-create'
}

type GeneratorsCreateAction = {
  action: 'generators:create'
}

type GeneratorsCloneAction = {
  action: 'generators:clone'
}

type GeneratorsImportAction = {
  action: 'generators:import'
}

type GeneratorsRemoveAction = {
  action: 'generators:remove'
}

type GeneratorsListAction = {
  action: 'generators:list'
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
  | GenerateAction
  | CloneAction
  | AddAction
  | LoginAction
  | LogoutAction
  | DeployAction
  | UploadAction
  | ArtifactsAction
  | ProjectCreateAction
  | WorkspaceGetAction
  | WorkspaceSetAction
  | BaseImagePullAction
  | BaseImagePushAction
  | ExitAction

const getOptions = async () => {
  const homeExists = await hasHome()
  const generatorsExist = await hasGenerators()

  console.log('HOME EXISTS', homeExists)
  console.log('GENERATORS EXIST', generatorsExist)

  if (!homeExists) {
    return [
      { name: 'Create new API Foundry project', value: { action: 'init' } },
      { name: 'Log in to Codesquared', value: { action: 'login' } },
      { name: 'Log out', value: { action: 'logout' } },
      { name: 'Exit', value: { action: 'exit' } }
    ]
  }

  if (!generatorsExist) {
    return [
      {
        name: 'Clone a generator from JSR registry for editing',
        value: { action: 'clone' }
      },
      { name: 'Add a new schema from url', value: { action: 'add' } },
      { name: 'Exit', value: { action: 'exit' } }
    ]
  }

  return [
    { name: 'Run code generator', value: { action: 'generate' } },
    {
      name: 'Clone a generator from JSR registry for editing',
      value: { action: 'clone' }
    },
    { name: 'Add a new schema from url', value: { action: 'add' } },
    { name: 'Exit', value: { action: 'exit' } }
  ]
}

const promptwise = async () => {
  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to smktc! What would you like to do?',
    options: await getOptions()
  })

  await match(action)
    .with({ action: 'init' }, async () => await toInitPrompt())
    .with({ action: 'generate' }, async () => await generatePrompt())
    .with({ action: 'workspace:set' }, async () => await toWorkspacesSetPrompt())
    .with({ action: 'workspace:get' }, async () => await toWorkspacesGetPrompt())
    .with({ action: 'base-image:pull' }, async () => await toBaseImagePullPrompt())
    .with({ action: 'base-image:push' }, async () => await toBaseImagePushPrompt())
    .with({ action: 'clone' }, async () => await toClonePrompt())
    .with({ action: 'add' }, async () => await toAddPrompt())
    .with({ action: 'login' }, async () => await toLoginPrompt())
    .with({ action: 'logout' }, async () => await toLogoutPrompt())
    .with({ action: 'deploy' }, async () => await toDeployPrompt())
    .with({ action: 'upload' }, async () => await toUploadPrompt())
    .with({ action: 'artifacts' }, async () => await toArtifactsPrompt())
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
  .command('generate', generateCommand())
  .command('init', toInitCommand())
  .command('workspace:set', toWorkspacesSetCommand())
  .command('workspace:get', toWorkspacesGetCommand())
  .command('base-image:pull', toBaseImagePullCommand())
  .command('base-image:push', toBaseImagePushCommand())
  .command('clone', toCloneCommand())
  .command('add', toAddCommand())
  .command('login', toLoginCommand())
  .command('logout', toLogoutCommand())
  .command('deploy', toDeployCommand())
  .command('upload', toUploadCommand())
  .command('artifacts', toArtifactsCommand())
  .parse(Deno.args)
