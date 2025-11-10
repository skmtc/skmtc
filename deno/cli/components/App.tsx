import React from 'react'
import { Box } from 'ink'
import { HomeView } from '@/components/HomeView.tsx'
import { ProjectView } from '@/components/ProjectView.tsx'
import { SkmtcProvider, useSkmtc } from '@/components/SkmtcContext.tsx'
import { CreateProjectView } from './CreateProjectView.tsx'
import { LoginView } from '@/components/LoginView.tsx'
import { AppInfo } from '@/components/AppInfo.tsx'
import { GenerateView } from '@/components/GenerateView.tsx'
import { DeployView } from '@/components/DeployView.tsx'
import { BundleView } from '@/components/BundleView.tsx'
import { RuntimeLogsView } from '@/components/RuntimeLogsView.tsx'
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

  switch (state.view.page) {
    case 'home': {
      return <HomeView />
    }
    case 'create-project': {
      const { projectName, generators, basePath } = state.view
      return (
        <CreateProjectView projectName={projectName} generators={generators} basePath={basePath} />
      )
    }
    case 'login': {
      return <LoginView />
    }
    case 'project': {
      return <ProjectView project={state.skmtcRoot.findProject(state.view.projectName)} />
    }
    case 'generate': {
      const view = state.view
      return (
        <GenerateView
          project={view.project}
          schemaSourceString={view.schemaSourceString}
          watchMode={view.watchMode}
        />
      )
    }
    case 'deploy': {
      const view = state.view
      return <DeployView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    }
    case 'bundle': {
      const view = state.view
      return <BundleView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    }
    case 'runtime-logs': {
      const view = state.view
      return <RuntimeLogsView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    }
    case 'list-generators': {
      const view = state.view
      return (
        <ListGeneratorsView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
      )
    }
    case 'create-generator': {
      const view = state.view
      return (
        <AddGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
      )
    }
    case 'install-generator': {
      const view = state.view
      return <InstallGeneratorView view={view} />
    }
    case 'clone-generator': {
      const view = state.view
      return (
        <CloneGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
      )
    }
    case 'remove-generator': {
      const view = state.view
      return (
        <RemoveGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
      )
    }
    case 'exit': {
      return <ExitView />
    }
  }
}
