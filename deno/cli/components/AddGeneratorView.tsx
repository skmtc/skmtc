import { type ViewStateAddGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import type { Project } from '@/lib/project.ts'
import { useEffect } from 'react'
import { SelectTask } from './SelectTask.tsx'
import { TaskListView } from './TaskListView.tsx'
import { TaskProvider, useTask } from './TaskContext.tsx'
import { StringTask } from './StringTask.tsx'
import invariant from 'tiny-invariant'
import { TaskBox } from './TaskBox.tsx'
import { Spinner } from '@/components/Spinner.tsx'

type AddGeneratorViewProps = {
  project: Project
  view: ViewStateAddGenerator
}

export const AddGeneratorView = ({ project, view }: AddGeneratorViewProps) => {
  const { dispatch, state } = useSkmtc()

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'generator-type-task',
          include: true,
          state: undefined,
          render: () => <GeneratorTypeTask />
        },
        {
          taskKey: 'generator-name-task',
          include: true,
          state: undefined,
          render: () => <GeneratorNameTask />
        },
        {
          taskKey: 'add-generator-task',
          include: true,
          state: undefined,
          render: () => <AddGeneratorTask project={project} language={view.language} />
        }
      ]}
      leave={() => {
        if (state.interactive) {
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        } else {
          dispatch({ type: 'set-view', payload: { page: 'exit' } })
        }
      }}
    >
      <TaskListView />
    </TaskProvider>
  )
}

type AddGeneratorTaskProps = {
  project: Project
  language?: 'typescript' | 'kotlin'
}

const AddGeneratorTask = ({ project, language }: AddGeneratorTaskProps) => {
  const { dispatch, dispatchMessage } = useSkmtc()
  const { state: taskState } = useTask()

  useEffect(() => {
    const taskEntries = taskState.tasks.map(task => [task.taskKey, task.state])

    const taskMap = Object.fromEntries(taskEntries)

    const generatorName = taskMap['generator-name-task']
    const generatorType = taskMap['generator-type-task']

    invariant(generatorName, 'Generator name is required')
    invariant(generatorType, 'Generator type is required')

    project
      .addGenerator({ moduleName: generatorName, type: generatorType, language })
      .then(() => {
        dispatchMessage({
          success: `"${generatorName}" (${generatorType}) generator added to ${project.name}`
        })
      })
      .catch(error => {
        console.error(error)

        dispatchMessage({ error: `Failed to add generator "${generatorName}"` })
      })
      .finally(() => {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
  }, [taskState.tasks, project])

  return (
    <TaskBox active>
      <Spinner label="Adding generator..." />
    </TaskBox>
  )
}

const GeneratorTypeTask = () => {
  const { dispatch } = useTask()

  return (
    <SelectTask
      prompt="Generator type"
      options={[
        { label: 'operation', value: 'operation' },
        { label: 'model', value: 'model' }
      ]}
      setValue={value => {
        dispatch({
          type: 'set-task-state',
          payload: { taskKey: 'generator-type-task', state: value as 'operation' | 'model' }
        })
      }}
    />
  )
}

const GeneratorNameTask = () => {
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt="Generator name"
      setValue={value => {
        dispatch({
          type: 'set-task-state',
          payload: { taskKey: 'generator-name-task', state: value }
        })
      }}
    />
  )
}
