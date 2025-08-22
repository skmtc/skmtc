import { Command } from '@cliffy/command'
import { toInitPrompt, toInitCommand } from './lib/init.ts'
import { type GenericListOptions, Select } from '@cliffy/prompt'
import { match } from 'ts-pattern'
import { toLoginCommand, toLogoutCommand, toLoginPrompt, toLogoutPrompt } from './auth/auth.ts'
import {
  toDeployCommand,
  toDeployPrompt,
  description as deployDescription
} from './generators/deploy.ts'
import { toGenerateCommand, toGeneratePrompt } from './generators/generate.ts'
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
import { toListCommand, toListPrompt, description as listDescription } from './generators/list.ts'
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
import { SkmtcRoot } from './lib/skmtc-root.ts'
import { Manager } from './lib/manager.ts'
import type { Project } from './lib/project.ts'

Sentry.init({
  dsn: 'https://9904234a7aabfeff2145622ccb0824e3@o4508018789646336.ingest.de.sentry.io/4509532871262288'
})

const kv = await Deno.openKv()

const manager = new Manager({ kv })
const skmtcRoot = await SkmtcRoot.open(manager)

type PromptResponse =
  | 'init'
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
  | 'workspaces:generate'
  | 'workspaces:info'
  | 'workspaces:link'
  | 'workspaces:message'
  | 'exit'

type ToHomeScreenOptionsArgs = {
  projects: Project[]
}

type Option = { name: string; value?: string }

const toHomeScreenOptions = ({ projects }: ToHomeScreenOptionsArgs) => {
  const projectOptions: Option[] = projects.map(({ name }) => ({
    name: ` - ${name}`,
    value: `project:${name}`
  }))

  if (projects.length) {
    projectOptions.unshift(Select.separator(`Select project `))
    projectOptions.push(Select.separator(` `))
  }

  return [
    { name: 'Create new Skmtc project', value: 'init' },
    Select.separator(` `),
    ...projectOptions,
    { name: 'Log in to Skmtc', value: 'login' },
    { name: 'Log out', value: 'logout' },
    { name: 'Exit', value: 'exit' }
  ]
}

type ToProjectOptionsArgs = {
  projectName: string
  isLoggedIn: boolean
}

const toProjectOptions = ({ projectName, isLoggedIn }: ToProjectOptionsArgs) => [
  Select.separator(` - Current project: ${projectName}`),
  {
    name: installDescription,
    value: 'generators:install'
  },
  {
    name: addDescription,
    value: 'generators:add'
  },
  {
    name: cloneDescription,
    value: 'generators:clone'
  },
  {
    name: listDescription,
    value: 'generators:list'
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
    name: workspacesGenerateDescription,
    value: 'workspaces:generate'
  },
  Select.separator(` -- `),
  { name: 'Home screen', value: 'home' },
  isLoggedIn ? { name: 'Log out', value: 'logout' } : { name: 'Log in to Skmtc', value: 'login' },
  { name: 'Exit', value: 'exit' }
]

const toAction = async () => {
  const { projects } = skmtcRoot

  const homeScreenAction = await Select.prompt<PromptResponse>({
    message: 'Welcome to Smktc! What would you like to do?',
    options: toHomeScreenOptions({ projects })
  })

  if (!homeScreenAction.startsWith('project:')) {
    return { action: homeScreenAction, projectName: '' }
  }

  const [_, projectName] = homeScreenAction.split(':')

  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to Smktc! What would you like to do?',
    options: toProjectOptions({ projectName, isLoggedIn: await skmtcRoot.isLoggedIn })
  })

  return { action, projectName }
}

const promptwise = async () => {
  const { action, projectName } = await toAction()

  await match(action)
    .with('init', async () => await toInitPrompt(skmtcRoot))
    // .with('base-files:push', async () => await toBaseFilesPushPrompt(skmtcRoot, projectName))
    .with('generators:add', async () => await toAddPrompt(skmtcRoot, projectName))
    .with('generators:clone', async () => await toClonePrompt(skmtcRoot, projectName))
    .with('generators:deploy', async () => await toDeployPrompt(skmtcRoot, projectName))
    .with('generators:generate', async () => await toGeneratePrompt(skmtcRoot, projectName))
    .with('generators:install', async () => await toInstallPrompt(skmtcRoot, projectName))
    .with('generators:list', () => toListPrompt(skmtcRoot, projectName))
    .with('generators:remove', async () => await toRemovePrompt(skmtcRoot, projectName))
    // .with('schemas:upload', async () => await toUploadPrompt(skmtcRoot, projectName))
    .with(
      'workspaces:generate',
      async () => await toWorkspacesGeneratePrompt(skmtcRoot, projectName)
    )
    .with('login', async () => await toLoginPrompt(skmtcRoot, projectName))
    .with('logout', async () => await toLogoutPrompt(skmtcRoot, projectName))
    .with('exit', () => Deno.exit(0))
    .otherwise(matched => {
      // do nothing
    })

  setTimeout(promptwise, 0)
}

await new Command()
  .description('Generate code from OpenAPI schema')
  .action(async _flags => {
    await promptwise()
  })
  .command('init', toInitCommand(skmtcRoot))
  // .command('base-files:push', toBaseFilesPushCommand(skmtcRoot))
  .command('generators:add', toAddCommand(skmtcRoot))
  .command('generators:clone', toCloneCommand(skmtcRoot))
  .command('generators:deploy', toDeployCommand(skmtcRoot))
  .command('generators:generate', toGenerateCommand(skmtcRoot))
  .command('generators:install', toInstallCommand(skmtcRoot))
  .command('generators:list', toListCommand(skmtcRoot))
  .command('generators:remove', toRemoveCommand(skmtcRoot))
  // .command('schemas:upload', toUploadCommand(skmtcRoot))
  .command('workspaces:generate', toWorkspacesGenerateCommand(skmtcRoot))
  .command('login', toLoginCommand(skmtcRoot))
  .command('logout', toLogoutCommand(skmtcRoot))
  .parse(Deno.args)
