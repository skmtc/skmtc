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
  const { dispatch, state } = useSkmtc()

  const [adding, setAdding] = useState(false)
  const username = state.session?.user.user_metadata.user_name

  const includeTypeQuestion = useMemo(() => {
    return typeof view.generatorType !== 'string'
  }, [view.generatorType])

  const includeNameQuestion = useMemo(() => {
    return typeof view.generatorName !== 'string' && typeof view.generatorType === 'string'
  }, [view.generatorName, view.generatorType])

  // Execute add generator when all inputs are collected
  useEffect(() => {
    if (view.generatorName && view.generatorType && project instanceof Project && !adding) {
      setAdding(true)

      project
        .addGenerator({ moduleName: view.generatorName, type: view.generatorType, username })
        .then(() => {
          dispatch({
            type: 'set-message',
            payload: {
              success: `Generator "${view.generatorName}" created successfully`
            }
          })
        })
        .catch(error => {
          console.error(error)

          dispatch({
            type: 'set-message',
            payload: {
              error: `Failed to add generator "${view.generatorName}"`
            }
          })
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
      include: includeTypeQuestion,
      render: () => <GeneratorTypeTask />
    },
    {
      key: 'generator-name-task',
      include: includeNameQuestion,
      render: () => <GeneratorNameTask />
    }
  ]

  return (
    <TaskProvider
      tasks={tasks}
      leave={() => {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
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

        invariant(view.page === 'add-generator', 'Generator type is required')

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

        invariant(view.page === 'add-generator', 'Generator name is required')

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
