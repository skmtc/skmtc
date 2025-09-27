import { Box } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { Home } from './Home.tsx'
import { match } from 'ts-pattern'
import { Project } from './Project.tsx'
import { SkmtcProvider, useSkmtc } from './SkmtcContext.tsx'
import { ProjectList } from './ProjectList.tsx'
import { CreateProject } from './CreateProject.tsx'
import { Login } from './Login.tsx'
import { AppInfo } from './AppInfo.tsx'

type AppProps = {
  skmtcRoot: SkmtcRoot
}
export const App = ({ skmtcRoot }: AppProps) => {
  return (
    <SkmtcProvider skmtcRoot={skmtcRoot}>
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
    .with({ page: 'project-list' }, () => <ProjectList />)
    .with({ page: 'create-project' }, () => <CreateProject />)
    .with({ page: 'login' }, () => <Login />)
    .with({ page: 'project' }, ({ projectName }) => <Project projectName={projectName} />)
    .exhaustive()
}
