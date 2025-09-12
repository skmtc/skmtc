import { Box, Text, Newline, useInput } from 'ink'
import { Select } from '@inkjs/ui'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { type ActionDispatch, useReducer, useEffect, useState } from 'react'
import { description as deployDescription } from '../generators/deploy.ts'
import { description as addDescription } from '../generators/add.ts'
import { description as installDescription } from '../generators/install.ts'
import { description as removeDescription } from '../generators/remove.ts'
import { description as listDescription } from '../generators/list.ts'
import { description as cloneDescription } from '../generators/clone.ts'
import { description as workspacesGenerateDescription } from '../workspaces/generate.ts'
import { description as runtimeLogsDescription } from '../workspaces/runtime-logs.ts'
import { match } from 'ts-pattern'
import { toInitPrompt } from '../lib/init.ts'
import { toAddPrompt } from '../generators/add.ts'
import { toClonePrompt } from '../generators/clone.ts'
import { toDeployPrompt } from '../generators/deploy.ts'
import { toGeneratePrompt } from '../workspaces/generate.ts'
import { toGenerateWatchPrompt } from '../workspaces/generate.ts'
import { toRuntimeLogsPrompt } from '../workspaces/runtime-logs.ts'
import { toInstallPrompt } from '../generators/install.ts'
import { toListPrompt } from '../generators/list.ts'
import { toRemovePrompt } from '../generators/remove.ts'
import { toLogoutPrompt } from '../auth/auth.ts'
import type { Project } from '../lib/project.ts'
import type { AppState, AppAction } from './types.ts'
import Link from 'ink-link'
import { TitledBox, titleStyles } from '@mishieck/ink-titled-box'
import { Alert } from '@inkjs/ui'

type AppProps = {
  skmtcRoot: SkmtcRoot
}

const appReducer = (state: AppState, action: AppAction): AppState => {
  return match(action)
    .returnType<AppState>()
    .with({ type: 'set-view' }, matched => {
      return { ...state, view: matched.view }
    })
    .with({ type: 'set-user' }, matched => {
      return { ...state, user: matched.user }
    })
    .with({ type: 'set-alert' }, matched => {
      return { ...state, alert: matched.alert }
    })
    .exhaustive()
}

export const App = ({ skmtcRoot }: AppProps) => {
  const [state, dispatch] = useReducer(appReducer, {
    view: { type: 'home' },
    user: null,
    alert: null
  })

  useEffect(() => {
    skmtcRoot.getUser().then(user => {
      dispatch({ type: 'set-user', user })
    })
  }, [])

  return (
    <Box flexDirection="column">
      {state.alert && <Alert variant={state.alert.type}>{state.alert.message}</Alert>}
      <Text>
        <Text color="#5a67d8">* </Text>Welcome to <Text bold>Skmtc</Text>, code generation service
        <Newline />
      </Text>

      {match(state)
        .with({ view: { type: 'home' } }, () => (
          <HomeView skmtcRoot={skmtcRoot} state={state} dispatch={dispatch} />
        ))
        .with({ view: { type: 'projects' } }, () => (
          <Projects skmtcRoot={skmtcRoot} dispatch={dispatch} />
        ))
        .with({ view: { type: 'login' } }, () => (
          <LoginView skmtcRoot={skmtcRoot} dispatch={dispatch} />
        ))
        .with({ view: { type: 'project' } }, matched => {
          const project = skmtcRoot.findProject(matched.view.projectName)

          return (
            <ProjectView
              skmtcRoot={skmtcRoot}
              project={project}
              state={state}
              dispatch={dispatch}
            />
          )
        })
        .exhaustive()}
    </Box>
  )
}

type LoginViewProps = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

const LoginView = ({ skmtcRoot, dispatch }: LoginViewProps) => {
  const [loginLink, setLoginLink] = useState<string>()
  console.clear()

  useEffect(() => {
    skmtcRoot.login({
      emitLoginLink: loginLink => setLoginLink(loginLink),
      onLogin: session => {
        console.clear()

        dispatch({ type: 'set-user', user: session.user })
        dispatch({ type: 'set-view', view: { type: 'home' } })
      }
    })
  }, [])

  return (
    <Box flexDirection="column">
      <Text>Click the link to login</Text>
      {loginLink && (
        <Link url={`${loginLink} `}>
          <Text color="cyan">Skmtc login</Text>
        </Link>
      )}
    </Box>
  )
}

type ProjectViewProps = {
  skmtcRoot: SkmtcRoot
  project: Project
  state: AppState
  dispatch: ActionDispatch<[action: AppAction]>
}

const ProjectView = ({ skmtcRoot, project, state, dispatch }: ProjectViewProps) => {
  return (
    <Box flexDirection="column">
      <Text>{project.name}</Text>
      <Select
        options={toProjectOptions()}
        onChange={option => {
          if (option === 'home') {
            dispatch({ type: 'set-view', view: { type: 'home' } })
          } else {
            runPrompt({ skmtcRoot, action: option, projectName: project.name, dispatch, state })
          }
        }}
      />
    </Box>
  )
}

type HomeViewProps = {
  skmtcRoot: SkmtcRoot
  state: AppState
  dispatch: ActionDispatch<[action: AppAction]>
}

type ToHomeOptionsArgs = {
  state: AppState
  skmtcRoot: SkmtcRoot
}

const toHomeOptions = ({ state, skmtcRoot }: ToHomeOptionsArgs) => {
  const initial: SelectOption[] = []

  if (skmtcRoot.projects.length) {
    initial.push({
      label: 'Select a project',
      value: 'select-project'
    })
  }

  return [
    ...initial,
    {
      label: 'Create new project',
      value: 'init'
    },
    {
      label: state.user ? 'Log out' : 'Log in to Skmtc',
      value: state.user ? 'logout' : 'login'
    },
    {
      label: 'Exit',
      value: 'exit'
    }
  ]
}

const HomeView = ({ skmtcRoot, state, dispatch }: HomeViewProps) => {
  return (
    <Box flexDirection="column">
      <Text dimColor>{`  To get started, select an option below`}</Text>

      <Select
        options={toHomeOptions({ state, skmtcRoot })}
        onChange={option => {
          match(option)
            .with('select-project', () =>
              dispatch({ type: 'set-view', view: { type: 'projects' } })
            )
            .with('init', () => {
              // create new project
              console.log('create new project')
            })
            .with('login', () => {
              dispatch({
                type: 'set-view',
                view: {
                  type: 'login'
                }
              })
            })
            .with('logout', async () => {
              await skmtcRoot.logout({ notify: alert => dispatch({ type: 'set-alert', alert }) })

              dispatch({ type: 'set-user', user: null })
            })
            .with('exit', () => Deno.exit(0))
            .otherwise(() => {
              // do nothing
            })
        }}
        visibleOptionCount={7}
      />
    </Box>
  )
}

type ProjectsProps = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

const Projects = ({ skmtcRoot, dispatch }: ProjectsProps) => {
  const options = skmtcRoot.projects.map(({ name }) => ({
    label: name,
    value: name
  }))

  useInput((_input, key) => {
    if (key.escape || key.leftArrow) {
      dispatch({ type: 'set-view', view: { type: 'home' } })
    }
  })

  return (
    <Box flexDirection="column">
      <Text dimColor>{`  Select a project to use:`}</Text>
      <Select
        options={options}
        onChange={option => {
          dispatch({ type: 'set-view', view: { type: 'project', projectName: option } })
        }}
        visibleOptionCount={7}
      />
    </Box>
  )
}

const toProjectOptions = () => [
  {
    label: workspacesGenerateDescription,
    value: 'generate'
  },
  {
    label: `${workspacesGenerateDescription} (watch)`,
    value: 'generate:watch'
  },

  {
    label: deployDescription,
    value: 'deploy'
  },
  {
    label: runtimeLogsDescription,
    value: 'runtime-logs'
  },
  {
    label: installDescription,
    value: 'install'
  },
  {
    label: addDescription,
    value: 'add'
  },
  {
    label: cloneDescription,
    value: 'clone'
  },
  {
    label: listDescription,
    value: 'list'
  },
  {
    label: removeDescription,
    value: 'remove'
  },
  { label: 'Back to home screen', value: 'home' }
]

type RunPromptArgs = {
  skmtcRoot: SkmtcRoot
  action: string
  projectName: string
  dispatch: ActionDispatch<[action: AppAction]>
  state: AppState
}

export const runPrompt = async ({ skmtcRoot, action, projectName, dispatch }: RunPromptArgs) => {
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
    .with('login', () => dispatch({ type: 'set-view', view: { type: 'login' } }))
    .with('logout', () => toLogoutPrompt({ skmtcRoot, dispatch }))
    .with('exit', () => Deno.exit(0))
    .otherwise(matched => {
      // do nothing
    })
}
