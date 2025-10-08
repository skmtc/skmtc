import React from 'react'
import { Box } from 'ink'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { HomeView } from '@/components/HomeView.tsx'
import { match } from 'ts-pattern'
import { ProjectView } from '@/components/ProjectView.tsx'
import { SkmtcProvider, useSkmtc, type ViewState } from '@/components/SkmtcContext.tsx'
import { CreateProject } from '@/components/CreateProject.tsx'
import { LoginView } from '@/components/LoginView.tsx'
import { AppInfo } from '@/components/AppInfo.tsx'
import type { Session } from '@supabase/supabase-js'
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

        <ShortcutsView />
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
    .with({ page: 'generate' }, view => {
      return <GenerateView project={view.project} view={view} />
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
    .with({ page: 'add-generator' }, view => (
      <AddGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'install-generator' }, view => (
      <InstallGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'clone-generator' }, view => (
      <CloneGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .with({ page: 'remove-generator' }, view => (
      <RemoveGeneratorView project={state.skmtcRoot.findProject(view.projectName)} view={view} />
    ))
    .exhaustive()
}
