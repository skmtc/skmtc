import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import { Project } from '../lib/project.ts'
import { TaskProvider, useTask } from './TaskContext.tsx'
import { StringTask } from './StringTask.tsx'
import { MultiselectTask } from './MultiselectTask.tsx'
import { TaskListView } from './TaskListView.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Spinner } from '@inkjs/ui'
import { Text } from 'ink'
import { useGetGenerators } from './useGetGenerators.ts'

export const CreateProject = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'project-name',
          include: true,
          state: undefined,
          render: () => <ProjectNameTask />
        },
        {
          taskKey: 'generators',
          include: true,
          state: undefined,
          render: () => <GeneratorsTask />
        },
        {
          taskKey: 'base-path',
          include: true,
          state: undefined,
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

const ProjectNameTask = () => {
  const { state } = useSkmtc()
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt="Project name"
      setValue={value => {
        const { skmtcRoot } = state

        if (value.length < 3) {
          console.error('Project name must be at least 3 characters long')
          return
        }

        // Check if project already exists
        const existingProject = skmtcRoot.projects.find(p => p.name === value)
        if (existingProject) {
          console.error(`Project "${value}" already exists`)
          return
        }

        dispatch({ type: 'set-task-state', payload: { taskKey: 'project-name', state: value } })
      }}
    />
  )
}

const GeneratorsTask = () => {
  const { dispatch } = useTask()
  const generators = useGetGenerators()

  if (!generators) {
    return (
      <TaskBox id={`generators-task`} active>
        <Spinner label="Loading generators..." />
      </TaskBox>
    )
  }

  if (generators.length === 0) {
    return (
      <TaskBox id={`generators-task`} active>
        <Text>No generators found</Text>
      </TaskBox>
    )
  }

  return (
    <MultiselectTask
      prompt="Select generators to install"
      options={generators.map(gen => ({
        label: `@${gen.scope}/${gen.packageName}`,
        value: `@${gen.scope}/${gen.packageName}`
      }))}
      setValues={values => {
        dispatch({ type: 'set-task-state', payload: { taskKey: 'generators', state: values } })
      }}
    />
  )
}

const BasePathTask = () => {
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt="Base path for generated files"
      defaultValue="src"
      setValue={value => {
        dispatch({ type: 'set-task-state', payload: { taskKey: 'base-path', state: value } })
      }}
    />
  )
}

const CreateProjectTask = () => {
  const { state, dispatch, dispatchMessage } = useSkmtc()
  const { state: taskState } = useTask()
  const availableGenerators = useGetGenerators()

  // Execute project creation when all inputs are collected
  useEffect(() => {
    const { skmtcRoot } = state

    const taskEntries = taskState.tasks.map(task => [task.taskKey, task.state])

    const taskMap = Object.fromEntries(taskEntries)

    const projectName = taskMap['project-name']
    const generators = taskMap['generators']
    const basePath = taskMap['base-path']

    if (projectName && generators?.length && basePath && availableGenerators?.length) {
      Project.create({
        skmtcRoot,
        name: projectName,
        basePath,
        generators,
        availableGenerators
      })
        .then(project => {
          dispatchMessage({ success: `Project "${project.name}" created` })

          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        })
        .catch(error => {
          console.error(error)

          dispatchMessage({ error: 'Failed to create project' })
          dispatch({ type: 'set-view', payload: { page: 'home' } })
        })
    }
  }, [state.view, availableGenerators])

  return (
    <TaskBox id={`create-project-container`} active>
      <Spinner label="Creating project..." />
    </TaskBox>
  )
}
