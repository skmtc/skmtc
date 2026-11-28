import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { useMemo } from 'react'
import { GeneratorsTask } from '@/tasks/GeneratorsTask.tsx'
import { BasePathTask } from '@/tasks/BasePathTask.tsx'
import { ProjectNameTask } from '@/tasks/ProjectNameTask.tsx'
import { CreateProjectTask } from '@/tasks/CreateProjectTask.tsx'
import type { AliasRoot } from '@/lib/alias-root.ts'

type CreateProjectViewProps = {
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
  /** The folder the app's `@/` alias points to: the default of the basePath prompt. */
  aliasRoot?: AliasRoot
}

export const CreateProjectView = ({
  projectName,
  generators,
  basePath,
  aliasRoot
}: CreateProjectViewProps) => {
  const { state, dispatch } = useSkmtc()

  const includeProjectName = useMemo(() => {
    return !projectName
  }, [])

  const includeGenerators = useMemo(() => {
    return !generators && state.interactive
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
          render: () => <BasePathTask aliasRoot={aliasRoot} />
        },
        {
          taskKey: 'create-project',
          include: true,
          state: undefined,
          render: () => <CreateProjectTask />
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
