import { Box } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { HomeView } from './HomeView.tsx'
import { match } from 'ts-pattern'
import { ProjectView } from './ProjectView.tsx'
import { SkmtcProvider, useSkmtc } from './SkmtcContext.tsx'
import { CreateProject } from './CreateProject.tsx'
import { LoginView } from './LoginView.tsx'
import { AppInfo } from './AppInfo.tsx'
import type { Session } from '@supabase/supabase-js'
import { GenerateView } from './GenerateView.tsx'

type AppProps = {
  skmtcRoot: SkmtcRoot
  session: Session | null
}
export const App = ({ skmtcRoot, session }: AppProps) => {
  return (
    <SkmtcProvider skmtcRoot={skmtcRoot} session={session}>
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
    .with({ page: 'generate' }, ({ projectName }) => (
      <GenerateView project={state.skmtcRoot.findProject(projectName)} />
    ))
    .exhaustive()
}
