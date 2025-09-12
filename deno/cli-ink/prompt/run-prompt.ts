import { toInitPrompt } from '../lib/init.ts'
import { Select } from '../components/index.ts'
import { match } from 'ts-pattern'
import { toLoginPrompt, toLogoutPrompt } from '../auth/auth.ts'
import { toDeployPrompt, description as deployDescription } from '../generators/deploy.ts'
import { toAddPrompt, description as addDescription } from '../generators/add.ts'
import { toInstallPrompt, description as installDescription } from '../generators/install.ts'
import { toRemovePrompt, description as removeDescription } from '../generators/remove.ts'
import { toListPrompt, description as listDescription } from '../generators/list.ts'
import { toClonePrompt, description as cloneDescription } from '../generators/clone.ts'
import {
  toGeneratePrompt,
  toGenerateWatchPrompt,
  description as workspacesGenerateDescription
} from '../workspaces/generate.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Project } from '../lib/project.ts'
import {
  toRuntimeLogsPrompt,
  description as runtimeLogsDescription
} from '../workspaces/runtime-logs.ts'

type PromptResponse =
  | 'init'
  | 'add'
  | 'clone'
  | 'deploy'
  | 'generate'
  | 'generate:watch'
  | 'runtime-logs'
  | 'install'
  | 'remove'
  | 'login'
  | 'logout'
  | 'project-create'
  | 'exit'
  | 'home'

type ToHomeScreenOptionsArgs = {
  isLoggedIn: boolean
  projects: Project[]
}

type Option = { name: string; value: string }

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
    value: 'generate'
  },
  {
    name: `${workspacesGenerateDescription} (watch)`,
    value: 'generate:watch'
  },
  Select.separator(` `),
  {
    name: deployDescription,
    value: 'deploy'
  },
  {
    name: runtimeLogsDescription,
    value: 'runtime-logs'
  },
  Select.separator(` `),
  {
    name: installDescription,
    value: 'install'
  },
  {
    name: addDescription,
    value: 'add'
  },
  {
    name: cloneDescription,
    value: 'clone'
  },
  {
    name: listDescription,
    value: 'list'
  },
  {
    name: removeDescription,
    value: 'remove'
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

const toAction = async (skmtcRoot: SkmtcRoot, initialProjectName?: string) => {
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

export const runPrompt = async (skmtcRoot: SkmtcRoot, initialProjectName?: string) => {
  const { action, projectName } = await toAction(skmtcRoot, initialProjectName)

  await match(action)
    .with('init', () => toInitPrompt(skmtcRoot))
    .with('add', () => toAddPrompt(skmtcRoot, projectName))
    .with('clone', () => toClonePrompt(skmtcRoot, projectName))
    .with('deploy', () => toDeployPrompt(skmtcRoot, projectName))
    .with('generate', () => toGeneratePrompt(skmtcRoot, projectName))
    .with('generate:watch', () => toGenerateWatchPrompt(skmtcRoot, projectName))
    .with('runtime-logs', () => toRuntimeLogsPrompt(skmtcRoot, projectName))
    .with('install', () => toInstallPrompt(skmtcRoot, projectName))
    .with('list', () => toListPrompt(skmtcRoot, projectName))
    .with('remove', () => toRemovePrompt(skmtcRoot, projectName))
    .with('login', () => toLoginPrompt(skmtcRoot, projectName))
    .with('logout', () => toLogoutPrompt(skmtcRoot, projectName))
    .with('exit', () => Deno.exit(0))
    .otherwise(matched => {
      // do nothing
    })

  setTimeout(() => runPrompt(skmtcRoot, projectName), 0)
}
