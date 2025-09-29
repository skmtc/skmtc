import { Box } from 'ink'
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
    .exhaustive()
}
