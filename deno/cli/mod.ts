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
  toGenerateCommand,
  toGeneratePrompt,
  toGenerateWatchPrompt,
  description as workspacesGenerateDescription
} from './workspaces/generate.ts'
import * as Sentry from '@sentry/deno'
import { SkmtcRoot } from './lib/skmtc-root.ts'
import { Manager } from './lib/manager.ts'
import type { Project } from './lib/project.ts'
import {
  toRuntimeLogsCommand,
  toRuntimeLogsPrompt,
  description as runtimeLogsDescription
} from './workspaces/runtime-logs.ts'

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
  | 'generators:generate:watch'
  | 'generators:runtime-logs'
  | 'generators:install'
  | 'generators:remove'
  | 'login'
  | 'logout'
  | 'project-create'
  | 'schemas:info'
  | 'schemas:link'
  | 'schemas:unlink'
  | 'generators:generate'
  | 'workspaces:info'
  | 'workspaces:link'
  | 'workspaces:message'
  | 'exit'

type ToHomeScreenOptionsArgs = {
  isLoggedIn: boolean
  projects: Project[]
}

type Option = { name: string; value?: string }

const toHomeScreenOptions = ({ projects, isLoggedIn }: ToHomeScreenOptionsArgs) => {
  const projectOptions: Option[] = projects.map(({ name }) => ({
    name: `${name}`,
    value: `project:${name}`
  }))

  if (projects.length) {
    projectOptions.unshift(Select.separator(`Select project `))
    projectOptions.push(Select.separator(` `))
  }

  return [
    ...projectOptions,
    { name: 'Create new project', value: 'init' },
    Select.separator(` `),
    isLoggedIn ? { name: 'Log out', value: 'logout' } : { name: 'Log in to Skmtc', value: 'login' },
    { name: 'Exit', value: 'exit' }
  ]
}

type ToProjectOptionsArgs = {
  projectName: string
}

const toProjectOptions = ({ projectName }: ToProjectOptionsArgs) => [
  Select.separator(` - Current project: ${projectName}`),
  {
    name: workspacesGenerateDescription,
    value: 'generators:generate'
  },
  {
    name: `${workspacesGenerateDescription} (watch)`,
    value: 'generators:generate:watch'
  },
  Select.separator(` `),
  {
    name: deployDescription,
    value: 'generators:deploy'
  },
  {
    name: runtimeLogsDescription,
    value: 'generators:runtime-logs'
  },
  Select.separator(` `),
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
  Select.separator(` `),
  { name: 'Back to home screen', value: 'home' }
]

type ToSelectActionArgs = {
  initialProjectName?: string
  projects: Project[]
  isLoggedIn: boolean
}

const toSelectAction = async ({ initialProjectName, projects, isLoggedIn }: ToSelectActionArgs) => {
  if (!initialProjectName) {
    const homeScreenAction = await Select.prompt<PromptResponse>({
      message: 'Welcome to Smktc! What would you like to do?',
      options: toHomeScreenOptions({ projects, isLoggedIn })
    })

    if (homeScreenAction.startsWith('project:')) {
      const [_, projectName] = homeScreenAction.split(':')

      return { action: 'skip', projectName }
    }

    return { action: homeScreenAction, projectName: '' }
  }

  const action = await Select.prompt<PromptResponse>({
    message: 'Welcome to Smktc! What would you like to do?',
    options: toProjectOptions({ projectName: initialProjectName })
  })

  return { action, projectName: action === 'home' ? '' : initialProjectName }
}

const toAction = async (initialProjectName?: string) => {
  const { projects } = skmtcRoot

  const isLoggedIn = await skmtcRoot.isLoggedIn

  return new Promise<{ action: string; projectName: string }>(resolve => {
    toSelectAction({
      initialProjectName,
      projects,
      isLoggedIn
    }).then(({ action, projectName }) => resolve({ action, projectName }))
  })
}

const promptwise = async (initialProjectName?: string) => {
  const { action, projectName } = await toAction(initialProjectName)

  const res = await match(action)
    .with('init', () => toInitPrompt(skmtcRoot))
    .with('generators:add', () => toAddPrompt(skmtcRoot, projectName))
    .with('generators:clone', () => toClonePrompt(skmtcRoot, projectName))
    .with('generators:deploy', () => toDeployPrompt(skmtcRoot, projectName))
    .with('generators:generate', () => toGeneratePrompt(skmtcRoot, projectName))
    .with('generators:generate:watch', () => toGenerateWatchPrompt(skmtcRoot, projectName))
    .with('generators:runtime-logs', () => toRuntimeLogsPrompt(skmtcRoot, projectName))
    .with('generators:install', () => toInstallPrompt(skmtcRoot, projectName))
    .with('generators:list', () => toListPrompt(skmtcRoot, projectName))
    .with('generators:remove', () => toRemovePrompt(skmtcRoot, projectName))
    // .with('schemas:upload',  () =>  toUploadPrompt(skmtcRoot, projectName))
    .with('login', () => toLoginPrompt(skmtcRoot, projectName))
    .with('logout', () => toLogoutPrompt(skmtcRoot, projectName))
    .with('exit', () => Deno.exit(0))
    .otherwise(matched => {
      // do nothing
    })

  setTimeout(() => promptwise(res?.projectName ?? projectName), 0)
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
  .command('generators:install', toInstallCommand(skmtcRoot))
  .command('generators:list', toListCommand(skmtcRoot))
  .command('generators:runtime-logs', toRuntimeLogsCommand(skmtcRoot))
  .command('generators:remove', toRemoveCommand(skmtcRoot))
  // .command('schemas:upload', toUploadCommand(skmtcRoot))
  .command('generators:generate', toGenerateCommand(skmtcRoot))
  .command('login', toLoginCommand(skmtcRoot))
  .command('logout', toLogoutCommand(skmtcRoot))
  .parse(Deno.args)
