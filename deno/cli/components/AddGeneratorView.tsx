import React from 'react'
import { type ViewStateAddGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { useState, useEffect } from 'react'
import { SelectTask } from './SelectTask.tsx'
import { TaskListView } from './TaskListView.tsx'
import { TaskProvider, useTask } from './TaskContext.tsx'
import { StringTask } from './StringTask.tsx'
import invariant from 'tiny-invariant'
import { TaskBox } from './TaskBox.tsx'
import { Spinner } from '@/components/Spinner.tsx'

type AddGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateAddGenerator
}

export const AddGeneratorView = ({ project }: AddGeneratorViewProps) => {
  const { dispatch, state } = useSkmtc()

  invariant(project instanceof Project, 'Local project is required')

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
          render: () => <AddGeneratorTask project={project} />
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
}

const AddGeneratorTask = ({ project }: AddGeneratorTaskProps) => {
  const { state: skmtcState, dispatch, dispatchMessage } = useSkmtc()
  const { state: taskState } = useTask()

  const username = skmtcState.session?.user.user_metadata.user_name

  useEffect(() => {
    const taskEntries = taskState.tasks.map(task => [task.taskKey, task.state])

    const taskMap = Object.fromEntries(taskEntries)

    const generatorName = taskMap['generator-name-task']
    const generatorType = taskMap['generator-type-task']

    invariant(generatorName, 'Generator name is required')
    invariant(generatorType, 'Generator type is required')

    project
      .addGenerator({ moduleName: generatorName, type: generatorType, username })
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
    <TaskBox id={`deploy-project-task`} active>
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
