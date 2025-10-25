import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { useMemo } from 'react'
import { GeneratorsTask } from '@/tasks/GeneratorsTask.tsx'
import { BasePathTask } from '@/tasks/BasePathTask.tsx'
import { ProjectNameTask } from '@/tasks/ProjectNameTask.tsx'
import { CreateProjectTask } from '@/tasks/CreateProjectTask.tsx'

type CreateProjectProps = {
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
}

export const CreateProject = ({ projectName, generators, basePath }: CreateProjectProps) => {
  const { state, dispatch } = useSkmtc()

  const includeProjectName = useMemo(() => {
    return !projectName
  }, [])

  const includeGenerators = useMemo(() => {
    return !generators
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
          taskKey: 'generators',
          include: includeGenerators,
          state: generators,
          render: () => <GeneratorsTask />
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
      leave={() => {
        if (state.interactive) {
          dispatch({ type: 'set-view', payload: { page: 'home' } })
        } else {
          dispatch({ type: 'set-view', payload: { page: 'exit' } })
        }
      }}
    >
      <TaskListView />
    </TaskProvider>
  )
}
