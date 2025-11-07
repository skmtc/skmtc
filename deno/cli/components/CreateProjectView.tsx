import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { useMemo } from 'react'
import { GeneratorsTask } from '@/tasks/GeneratorsTask.tsx'
import { BasePathTask } from '@/tasks/BasePathTask.tsx'
import { ProjectNameTask } from '@/tasks/ProjectNameTask.tsx'
import { CreateProjectTask } from '@/tasks/CreateProjectTask.tsx'

type CreateProjectViewProps = {
  projectName: string | undefined
  basePath: string | undefined
}

export const CreateProjectView = ({ projectName, basePath }: CreateProjectViewProps) => {
  const { state, dispatch } = useSkmtc()

  const includeProjectName = useMemo(() => {
    return !projectName
  }, [])

  const includeBasePath = useMemo(() => {
    return !basePath
  }, [])

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'project-name',
          include: includeProjectName,
          state: projectName,
          render: () => <ProjectNameTask />
        },
        {
          taskKey: 'base-path',
          include: includeBasePath,
          state: basePath,
          render: () => <BasePathTask />
        },
        {
          taskKey: 'create-project',
          include: true,
          state: undefined,
          render: () => <CreateProjectTask />
        }
      ]}
      leave={({ state: taskState }) => {
        const project = taskState['create-project-task']

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
