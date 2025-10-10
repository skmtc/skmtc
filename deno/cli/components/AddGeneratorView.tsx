import React from 'react'
import { type ViewStateAddGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { useMemo, useState, useEffect } from 'react'
import { SelectTask } from './SelectTask.tsx'
import invariant from 'tiny-invariant'
import type { Task } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { TaskProvider } from './TaskContext.tsx'
import { StringTask } from './StringTask.tsx'

type AddGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateAddGenerator
}

export const AddGeneratorView = ({ project, view }: AddGeneratorViewProps) => {
  const { dispatch, dispatchMessage, state } = useSkmtc()

  const [adding, setAdding] = useState(false)
  const username = state.session?.user.user_metadata.user_name

  // Execute add generator when all inputs are collected
  useEffect(() => {
    if (view.generatorName && view.generatorType && project instanceof Project && !adding) {
      setAdding(true)

      project
        .addGenerator({ moduleName: view.generatorName, type: view.generatorType, username })
        .then(() => {
          dispatchMessage({ success: `Generator "${view.generatorName}" created successfully` })
        })
        .catch(error => {
          console.error(error)

          dispatchMessage({ error: `Failed to add generator "${view.generatorName}"` })
        })
        .finally(() => {
          setAdding(false)
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        })
    }
  }, [view.generatorName, view.generatorType, adding])

  const tasks: Task[] = [
    {
      key: 'generator-type-task',
      include: true,
      render: () => <GeneratorTypeTask />
    },
    {
      key: 'generator-name-task',
      include: true,
      render: () => <GeneratorNameTask />
    }
  ]

  return (
    <TaskProvider
      tasks={tasks}
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

const GeneratorTypeTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <SelectTask
      prompt="Generator type"
      options={[
        { label: 'operation', value: 'operation' },
        { label: 'model', value: 'model' }
      ]}
      setValue={value => {
        const { view } = state

        invariant(view.page === 'create-generator', 'Generator type is required')

        dispatch({
          type: 'set-view',
          payload: {
            ...view,
            generatorType: value as 'operation' | 'model'
          }
        })
      }}
    />
  )
}

const GeneratorNameTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <StringTask
      prompt="Generator name"
      setValue={value => {
        const { view } = state

        invariant(view.page === 'create-generator', 'Generator name is required')

        dispatch({
          type: 'set-view',
          payload: {
            ...view,
            generatorName: value
          }
        })
      }}
    />
  )
}
