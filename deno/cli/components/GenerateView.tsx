import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { generate, toGenerateMessage } from '@/commands/generate.tsx'
import { match } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { join, relative } from 'node:path'
import { isAbsolute } from '@std/path/is-absolute'
import invariant from 'tiny-invariant'
import { type BiomeInstance, TaskProvider, tasksToState, useTask } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { StringTask } from './StringTask.tsx'
import { BooleanTask } from '@/tasks/BooleanTask.tsx'
import { Spinner } from '@/components/Spinner.tsx'
import { useShortcut } from './useShortcut.tsx'
import { TaskBox } from './TaskBox.tsx'
import { ServerTask } from '@/tasks/ServerTask.tsx'
import { BasePathTask } from '@/tasks/BasePathTask.tsx'
import { StartBiomeTask } from '../tasks/StartBiomeTask.tsx'

type GenerateProps = {
  project: Project | RemoteProject
  schemaSourceString: string | undefined
  watchMode: boolean | undefined
  basePath: string | undefined
}

export const GenerateView = ({
  project,
  schemaSourceString,
  watchMode,
  basePath
}: GenerateProps) => {
  const { dispatch, state } = useSkmtc()

  const includeBasePathTask = useMemo(() => {
    return Boolean(!basePath)
  }, [])

  const includeSchemaTask = useMemo(() => {
    return typeof schemaSourceString !== 'string'
  }, [])

  const includeWatchTask = useMemo(() => {
    if (isRemoteSchema(schemaSourceString)) {
      return false
    }

    return typeof watchMode !== 'boolean'
  }, [])

  const watchModeState = useMemo(() => {
    if (isRemoteSchema(schemaSourceString)) {
      return false
    }

    return watchMode
  }, [])

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'start-server-task',
          include: project instanceof Project,
          state: undefined,
          render: () => <ServerTask project={project as Project} />
        },

        {
          taskKey: 'base-path',
          include: includeBasePathTask,
          state: basePath,
          render: () => <BasePathTask />
        },
        {
          taskKey: 'start-biome-task',
          include: true,
          state: undefined,
          render: () => <StartBiomeTask prettierConfig={project.prettierJson?.contents} />
        },
        {
          taskKey: 'schema-location-task',
          include: includeSchemaTask,
          state: schemaSourceString,
          render: () => <SchemaLocationTask project={project} />
        },
        {
          taskKey: 'watch-mode-task',
          include: includeWatchTask,
          state: watchModeState,
          render: () => <WatchModeTask />
        },
        {
          taskKey: 'generate-view-content-task',
          include: true,
          state: undefined,
          render: () => <GenerateTask project={project} />
        }
      ]}
      leave={({ state: taskState }) => {
        const { 'start-server-task': child } = taskState

        child?.kill()

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

const WatchModeTask = () => {
  const { state: taskState, dispatch: taskDispatch } = useTask()

  const { 'schema-location-task': schemaSourceString } = tasksToState(taskState.tasks)

  // useEffect(() => {
  //   if (isRemoteSchema(schemaSourceString)) {
  //     taskDispatch({
  //       type: 'set-task-state',
  //       payload: { taskKey: 'watch-mode-task', state: false }
  //     })

  //     taskDispatch({ type: 'increment-current-task' })
  //   }
  // }, [])

  return (
    <BooleanTask
      prompt="Watch for changes?"
      setValue={({ value }) => {
        taskDispatch({
          type: 'set-task-state',
          payload: { taskKey: 'watch-mode-task', state: value }
        })

        taskDispatch({ type: 'increment-current-task' })
      }}
    />
  )
}

type SchemaLocationTaskProps = {
  project: Project | RemoteProject
}

const SchemaLocationTask = ({ project }: SchemaLocationTaskProps) => {
  const { dispatch: taskDispatch } = useTask()
  const schemaSource = project.schemaFile?.schemaSource
  const absoluteRootPath = toAbsoluteRootPath()

  return (
    <StringTask
      prompt="Input OpenAPI schema path or URL"
      defaultValue={
        schemaSource?.type === 'local' ? relative(absoluteRootPath, schemaSource.path) : undefined
      }
      setValue={value => {
        taskDispatch({
          type: 'set-task-state',
          payload: { taskKey: 'schema-location-task', state: value }
        })

        // if (isRemoteSchema(value)) {
        //   taskDispatch({
        //     type: 'set-task-state',
        //     payload: { taskKey: 'watch-mode-task', state: false }
        //   })
        // }
      }}
    />
  )
}

type GenerateTaskProps = {
  project: Project | RemoteProject
}

const GenerateTask = ({ project }: GenerateTaskProps) => {
  const { state } = useSkmtc()
  const { state: taskState } = useTask()

  const token = state.session?.access_token

  const {
    'base-path': basePath,
    'schema-location-task': schemaLocation,
    'watch-mode-task': watchMode
  } = tasksToState(taskState.tasks)

  invariant(basePath, 'Base path is required')
  invariant(schemaLocation, 'Schema location is required')
  invariant(typeof watchMode === 'boolean', 'Watch mode is required')

  return watchMode ? (
    <WatchGenerateTask project={project} schemaSourceString={schemaLocation} token={token} />
  ) : (
    <RunGenerateTask project={project} schemaSourceString={schemaLocation} token={token} />
  )
}

type RunGenerateProps = {
  project: Project | RemoteProject
  schemaSourceString: string
  token: string | undefined
}

const RunGenerateTask = ({ project, schemaSourceString, token }: RunGenerateProps) => {
  const { state, dispatchMessage } = useSkmtc()
  const { state: taskState, leave } = useTask()

  useShortcut({
    key: 'esc',
    name: project.name,
    action: (input, key) => {
      if (key.escape) {
        leave({ state: tasksToState(taskState.tasks) })
      }
    }
  })

  useEffect(() => {
    toSchemaContents(schemaSourceString)
      .then(schemaContents => {
        return generate({
          project,
          skmtcRoot: state.skmtcRoot,
          accountName: state.session?.user?.user_metadata?.user_name,
          schemaContents,
          clientSettings: project.clientJson?.contents?.settings,
          biomeInstance: taskState.tasks.find(task => task.taskKey === 'start-biome-task')
            ?.state as Promise<BiomeInstance> | undefined,
          token
        })
      })
      .then(stats => {
        dispatchMessage(toGenerateMessage(stats))

        leave({ state: tasksToState(taskState.tasks) })
      })
      .catch(error => {
        console.error(error)

        leave({ state: tasksToState(taskState.tasks) })
      })
  }, [])

  return (
    <TaskBox id={`run-generate-container`} active>
      <Spinner label="Generating..." />
    </TaskBox>
  )
}

const toSchemaContents = async (schemaSourceString: string): Promise<string> => {
  const schemaSource = toSchemaSource(schemaSourceString)

  if (schemaSource.type === 'local' && !isAbsolute(schemaSource.path)) {
    schemaSource.path = join(toAbsoluteRootPath(), schemaSource.path)
  }

  const { contents } = await SchemaFile.getFromSource(schemaSource)

  return contents
}

type Activity = 'watching' | 'generating'

type WatchGenerateProps = {
  project: Project | RemoteProject
  schemaSourceString: string
  token: string | undefined
}

const WatchGenerateTask = ({ project, schemaSourceString, token }: WatchGenerateProps) => {
  const { state, dispatchMessage } = useSkmtc()
  const { state: taskState, leave } = useTask()
  const [watcher, setWatcher] = useState<FSWatcher>()
  const [activity, setActivity] = useState<Activity>('watching')

  useShortcut({
    key: 'esc',
    name: project.name,
    action: async (input, key) => {
      if (key.escape) {
        await watcher?.close()

        leave({ state: tasksToState(taskState.tasks) })
      }
    }
  })

  useEffect(() => {
    setWatcher(chokidar.watch(schemaSourceString))

    return () => {
      setWatcher(undefined)
    }
  }, [schemaSourceString])

  useEffect(() => {
    if (activity === 'watching') {
      return
    }

    SchemaFile.getFromSource(toSchemaSource(schemaSourceString))
      .then(({ contents }) => {
        return generate({
          project,
          accountName: state.session?.user?.user_metadata?.user_name,
          skmtcRoot: state.skmtcRoot,
          schemaContents: contents,
          clientSettings: project.clientJson?.contents?.settings,
          biomeInstance: taskState.tasks.find(task => task.taskKey === 'start-biome-task')
            ?.state as Promise<BiomeInstance> | undefined,
          token
        })
      })
      .then(stats => {
        dispatchMessage(toGenerateMessage(stats))

        setActivity('watching')
      })
      .catch(error => {
        console.error(error)

        dispatchMessage({ error: 'Failed to generate' })

        leave({ state: tasksToState(taskState.tasks) })
      })
  }, [watcher, activity])

  useEffect(() => {
    watcher?.on('change', () => {
      if (activity !== 'generating') {
        setActivity('generating')
      }
    })
  }, [watcher, activity])

  return (
    <TaskBox id={`watch-generate-container`} active>
      <Spinner
        label={match(activity)
          .with('generating', () => 'Generating...')
          .with('watching', () => 'Watching...')
          .exhaustive()}
      />
    </TaskBox>
  )
}

const isRemoteSchema = (string: string | undefined): boolean => {
  return Boolean(string?.startsWith('http://') || string?.startsWith('https://'))
}
