import React from 'react'
import { Box } from 'ink'
import { HomeView } from '@/components/HomeView.tsx'
import { match } from 'ts-pattern'
import { ProjectView } from '@/components/ProjectView.tsx'
import { SkmtcProvider, useSkmtc } from '@/components/SkmtcContext.tsx'
import { CreateProjectView } from './CreateProjectView.tsx'
import { LoginView } from '@/components/LoginView.tsx'
import { AppInfo } from '@/components/AppInfo.tsx'
import { GenerateView } from '@/components/GenerateView.tsx'
import { DeployView } from '@/components/DeployView.tsx'
import { RuntimeLogsView } from '@/components/RuntimeLogsView.tsx'
import { ServeView } from '@/components/ServeView.tsx'
import { ListGeneratorsView } from '@/components/ListGeneratorsView.tsx'
import { AddGeneratorView } from '@/components/AddGeneratorView.tsx'
import { InstallGeneratorView } from '@/components/InstallGeneratorView.tsx'
import { CloneGeneratorView } from '@/components/CloneGeneratorView.tsx'
import { RemoveGeneratorView } from '@/components/RemoveGeneratorView.tsx'
import { ShortcutsView } from './ShortcutsView.tsx'
import { MessageBox } from './MessageBox.tsx'
import { ExitView } from './ExitView.tsx'
import { useApp } from 'ink'
import type { SkmtcState } from './SkmtcContext.tsx'
export type AppProps = {
  initialState: SkmtcState
}

export const App = ({ initialState }: AppProps) => {
  const { exit } = useApp()

  return (
    <SkmtcProvider initialState={initialState} exit={exit}>
      <Box flexDirection="column">
        <AppInfo />
        <MessageBox />
        <ViewManager />
        <ShortcutsView />
      </Box>
    </SkmtcProvider>
  )
}

export const ViewManager = () => {
  const { state } = useSkmtc()

  return match(state.view)
    .with({ page: 'home' }, () => <HomeView />)
    .with({ page: 'create-project' }, ({ projectName, generators, basePath }) => (
      <CreateProjectView projectName={projectName} generators={generators} basePath={basePath} />
    ))
    .with({ page: 'login' }, () => <LoginView />)
    .with({ page: 'project' }, ({ projectName }) => (
      <ProjectView project={state.skmtcRoot.findProject(projectName)} />
    ))
    .with({ page: 'generate' }, view => {
      return (
        <GenerateView
          project={view.project}
          schemaSourceString={view.schemaSourceString}
          watchMode={view.watchMode}
          basePath={view.basePath}
        />
      )
    })
    .with({ page: 'deploy' }, view => {
      return <DeployView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    })
    .with({ page: 'runtime-logs' }, view => (
      <RuntimeLogsView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'serve' }, view => (
      <ServeView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'list-generators' }, view => (
      <ListGeneratorsView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'create-generator' }, view => (
      <AddGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'install-generator' }, view => <InstallGeneratorView view={view} />)
    .with({ page: 'clone-generator' }, view => (
      <CloneGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'remove-generator' }, view => (
      <RemoveGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'exit' }, () => <ExitView />)
    .exhaustive()
}
