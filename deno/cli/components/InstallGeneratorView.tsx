import { useMemo } from 'react'
import { type ViewStateInstallGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { GeneratorsTask } from '@/tasks/GeneratorsTask.tsx'
import { SelectProjectTask } from '@/tasks/SelectProjectTask.tsx'
import { InstallGeneratorsTask } from '@/tasks/InstallGeneratorsTask.tsx'

type InstallGeneratorViewProps = {
  view: ViewStateInstallGenerator
}

export const InstallGeneratorView = ({ view }: InstallGeneratorViewProps) => {
  const { state, dispatch } = useSkmtc()

  const includeProjectName = useMemo(() => {
    return !view.projectName
  }, [])

  const includeGenerators = useMemo(() => {
    return !view.generators?.length
  }, [])

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'select-project-task',
          include: includeProjectName,
          state: state.skmtcRoot.projects.find(project => project.name === view.projectName),
          render: () => <SelectProjectTask />
        },
        {
          taskKey: 'generators',
          include: includeGenerators,
          state: view.generators,
          render: () => <GeneratorsTask />
        },
        {
          taskKey: 'install-generators-task',
          include: true,
          state: undefined,
          render: () => <InstallGeneratorsTask />
        }
      ]}
      leave={({ state: taskState }) => {
        const project = taskState['create-project']

        if (state.interactive && project) {
          dispatch({
            type: 'set-view',
            payload: { page: 'project', projectName: project.name }
          })
        } else {
          dispatch({ type: 'set-view', payload: { page: 'exit' } })
        }
      }}
    >
      <TaskListView />
    </TaskProvider>
  )
}
