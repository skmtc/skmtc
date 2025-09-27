import { Box } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { Home } from './Home.tsx'
import { match } from 'ts-pattern'
import { Project } from './Project.tsx'
import { SkmtcProvider, useSkmtc } from './SkmtcContext.tsx'
import { CreateProject } from './CreateProject.tsx'
import { Login } from './Login.tsx'
import { AppInfo } from './AppInfo.tsx'
import type { Session } from '@supabase/supabase-js'

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
    .with({ page: 'home' }, () => <Home />)
    .with({ page: 'create-project' }, () => <CreateProject />)
    .with({ page: 'login' }, () => <Login />)
    .with({ page: 'project' }, ({ projectName }) => <Project projectName={projectName} />)
    .exhaustive()
}
