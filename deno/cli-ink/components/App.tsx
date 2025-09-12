import { Box, Text, Newline } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { type ActionDispatch, useReducer, useEffect } from 'react'
import { match } from 'ts-pattern'
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
import type { AppState, AppAction } from './types.ts'
import { LoginView } from './LoginView.tsx'
import { Alert } from '@inkjs/ui'
import { ProjectView } from './ProjectView.tsx'
import { ProjectsView } from './ProjectsView.tsx'
import { HomeView } from './HomeView.tsx'
import { CreateProjectView } from './CreateProjectView.tsx'

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

const useKeepAlive = () =>
  useEffect(() => {
    setInterval(() => {}, 100)
  }, [])

export const App = ({ skmtcRoot }: AppProps) => {
  useKeepAlive()

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
          <ProjectsView skmtcRoot={skmtcRoot} dispatch={dispatch} />
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
        .with({ view: { type: 'create-project' } }, () => (
          <CreateProjectView skmtcRoot={skmtcRoot} dispatch={dispatch} />
        ))
        .exhaustive()}
    </Box>
  )
}

type RunPromptArgs = {
  skmtcRoot: SkmtcRoot
  action: string
  projectName: string
  dispatch: ActionDispatch<[action: AppAction]>
  state: AppState
}

export const runPrompt = async ({ skmtcRoot, action, projectName, dispatch }: RunPromptArgs) => {
  await match(action)
    .with('init', () => dispatch({ type: 'set-view', view: { type: 'create-project' } }))
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
