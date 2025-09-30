import { Box, Text } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { HomeView } from './HomeView.tsx'
import { match } from 'ts-pattern'
import { ProjectView } from './ProjectView.tsx'
import { SkmtcProvider, useSkmtc, type ViewState } from './SkmtcContext.tsx'
import { CreateProject } from './CreateProject.tsx'
import { LoginView } from './LoginView.tsx'
import { AppInfo } from './AppInfo.tsx'
import type { Session } from '@supabase/supabase-js'
import { GenerateView } from './GenerateView.tsx'
import { Spinner } from '@inkjs/ui'
import { DeployView } from './DeployView.tsx'
import { RuntimeLogsView } from './RuntimeLogsView.tsx'

type AppProps = {
  skmtcRoot: SkmtcRoot
  session: Session | null
  view: ViewState
  interactive: boolean
}
export const App = (props: AppProps) => {
  return (
    <SkmtcProvider {...props}>
      <Box flexDirection="column">
        <AppInfo />

        <ViewManager />

        <ExecutionManager />
      </Box>
    </SkmtcProvider>
  )
}

const ViewManager = () => {
  const { state } = useSkmtc()

  return match(state.view)
    .with({ page: 'home' }, () => <HomeView />)
    .with({ page: 'create-project' }, () => <CreateProject />)
    .with({ page: 'login' }, () => <LoginView />)
    .with({ page: 'project' }, ({ projectName }) => (
      <ProjectView project={state.skmtcRoot.findProject(projectName)} />
    ))
    .with({ page: 'generate' }, view => (
      <GenerateView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'deploy' }, view => (
      <DeployView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'runtime-logs' }, view => (
      <RuntimeLogsView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .exhaustive()
}

const ExecutionManager = () => {
  const { state } = useSkmtc()

  if (state.execution) {
    const { title, subtitle } = state.execution

    return (
      <Box flexDirection="column">
        <Spinner label={title} />
        {subtitle ? <Text dimColor>{subtitle}</Text> : null}
      </Box>
    )
  }

  return <Box></Box>
}
