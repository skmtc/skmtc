import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import { availableGenerators } from '@/available-generators.ts'
import { Project } from '../lib/project.ts'
import { type Task, TaskProvider, useTask } from './TaskContext.tsx'
import { StringTask } from './StringTask.tsx'
import { MultiselectTask } from './MultiselectTask.tsx'
import invariant from 'tiny-invariant'
import { TaskListView } from './TaskListView.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Spinner } from '@inkjs/ui'

export const CreateProject = () => {
  const { dispatch } = useSkmtc()

  const tasks: Task[] = [
    {
      key: 'project-name',
      include: true,
      render: () => <ProjectNameTask />
    },
    {
      key: 'generators',
      include: true,
      render: () => <GeneratorsTask />
    },
    {
      key: 'base-path',
      include: true,
      render: () => <BasePathTask />
    },
    {
      key: 'create-project',
      include: true,
      render: () => <CreateProjectTask />
    }
  ]

  return (
    <TaskProvider
      tasks={tasks}
      leave={() => dispatch({ type: 'set-view', payload: { page: 'home' } })}
    >
      <TaskListView />
    </TaskProvider>
  )
}

const ProjectNameTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <StringTask
      prompt="Project name"
      setValue={value => {
        const { skmtcRoot, view } = state

        invariant(
          view.page === 'create-project',
          `Expecting view to be "create-project", got "${view.page}"`
        )

        const payload = { ...view, projectName: value }

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

        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

const GeneratorsTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <MultiselectTask
      prompt="Select generators"
      options={availableGenerators.map(gen => ({
        label: gen.id,
        value: gen.id
      }))}
      setValues={values => {
        const { view } = state

        invariant(
          view.page === 'create-project',
          `Expecting view to be "create-project", got "${view.page}"`
        )

        const payload = { ...view, generators: values }
        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

const BasePathTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <StringTask
      prompt="Base path for generated files"
      defaultValue="src"
      setValue={value => {
        const { view } = state

        invariant(
          view.page === 'create-project',
          `Expecting view to be "create-project", got "${view.page}"`
        )

        const payload = { ...view, basePath: value }

        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

const CreateProjectTask = () => {
  const { state, dispatch } = useSkmtc()

  const { leave } = useTask()

  // Execute project creation when all inputs are collected
  useEffect(() => {
    const { skmtcRoot, view } = state
    invariant(
      view.page === 'create-project',
      `Expecting view to be "create-project", got "${view.page}"`
    )
    const { projectName, generators, basePath } = view

    if (projectName && generators?.length && basePath) {
      Project.create({
        skmtcRoot,
        name: projectName,
        basePath,
        generators
      }).then(project => {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        leave()
      })
    }
  }, [state.view])

  return (
    <TaskBox id={`create-project-container`} active>
      <Spinner label="Creating project..." />
    </TaskBox>
  )
}
