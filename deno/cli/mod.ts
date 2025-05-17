import { Command } from '@cliffy/command'
import { generatePrompt, generateCommand } from './src/setupGenerate.ts'
import { toInitPrompt, toInitCommand } from './src/init.ts'
import { toClonePrompt, toCloneCommand } from './src/clone.ts'
import { toAddPrompt, toAddCommand } from './src/add.ts'
import { Select } from '@cliffy/prompt'
import { P, match } from 'npm:ts-pattern@5.2.0'
import { getDirectoryContents, getDirectoryNames, hasSchema } from './src/file.ts'
import { toLoginCommand, toLogoutCommand, toLoginPrompt, toLogoutPrompt } from './src/auth/auth.ts'
import { toUploadCommand, toUploadPrompt } from './src/upload/upload.ts'
import { toGenerateCommand, toGeneratePrompt } from './src/generate/generate.tsx'

const hasHome = async () => {
  const projectContents = await getDirectoryContents('./.schematic')

  return Boolean(projectContents)
}

const hasProjects = async () => {
  const projectContents = await getDirectoryContents('./.schematic')
  const projectNames = await getDirectoryNames(projectContents, hasSchema)

  return Boolean(projectNames?.length)
}

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

type UploadAction = {
  action: 'upload'
}

type ArtifactsAction = {
  action: 'artifacts'
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
  | UploadAction
  | ArtifactsAction
  | ExitAction

const getOptions = async () => {
  const homeExists = await hasHome()
  const projectsExist = await hasProjects()

  if (!homeExists) {
    return [
      { name: 'Create empty project', value: { action: 'init' } },
      { name: 'Log in to Codesquared', value: { action: 'login' } },
      { name: 'Log out', value: { action: 'logout' } },
      { name: 'Exit', value: { action: 'exit' } }
    ]
  }

  if (!projectsExist) {
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
    .with({ action: 'init', options: P.select() }, async options => await toInitPrompt(options))
    .with({ action: 'generate' }, async () => await generatePrompt())
    .with({ action: 'clone' }, async () => await toClonePrompt())
    .with({ action: 'add' }, async () => await toAddPrompt())
    .with({ action: 'login' }, async () => await toLoginPrompt())
    .with({ action: 'logout' }, async () => await toLogoutPrompt())
    .with({ action: 'upload' }, async () => await toUploadPrompt())
    .with({ action: 'artifacts' }, async () => await toGeneratePrompt())
    .with({ action: 'exit' }, () => Deno.exit(0))
    .otherwise(matched => {
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
  .command('clone', toCloneCommand())
  .command('add', toAddCommand())
  .command('login', toLoginCommand())
  .command('logout', toLogoutCommand())
  .command('upload', toUploadCommand())
  .command('artifacts', toGenerateCommand())
  .parse(Deno.args)
