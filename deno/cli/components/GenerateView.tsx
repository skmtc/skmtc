import React from 'react'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { toGenerateMessage } from '@/commands/generate.tsx'
import { generate } from '@/lib/generate.ts'
import { match } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { join } from '@std/path/join'
import { isAbsolute } from '@std/path/is-absolute'
import invariant from 'tiny-invariant'
import { TaskProvider, tasksToState, useTask } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import { WatchModeTask } from '@/tasks/WatchModeTask.tsx'
import { Spinner } from '@/components/Spinner.tsx'
import { useShortcut } from './useShortcut.tsx'
import { TaskBox } from './TaskBox.tsx'
import { BasePathTask } from '@/tasks/BasePathTask.tsx'
import { isHttp } from '@/lib/is-http.ts'
import { existsSync } from '@std/fs/exists'
import { GenerateBundleTask } from '@/tasks/GenerateBundleTask.tsx'
import { SchemaLocationTask } from '../tasks/SchemaLocationTask.tsx'

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
    return typeof basePath !== 'string'
  }, [])

  const includeSchemaTask = useMemo(() => {
    return (
      typeof schemaSourceString !== 'string' &&
      !project.clientJson?.contents?.settings?.schemaSource
    )
  }, [])

  const includeGenerateBundleTask = useMemo(() => {
    if (project instanceof RemoteProject) {
      return false
    }
    const bundlePath = join(project.toPath(), 'bundle.js')

    return !existsSync(bundlePath)
  }, [])

  const bundlePath = useMemo(() => {
    if (project instanceof Project) {
      const bundlePath = join(project.toPath(), 'bundle.js')

      return existsSync(bundlePath) ? bundlePath : undefined
    }

    return undefined
  }, [])

  const includeWatchTask = useMemo(() => {
    if (isHttp(schemaSourceString)) {
      return false
    }

    return typeof watchMode !== 'boolean'
  }, [])

  const watchModeState = useMemo(() => {
    return isHttp(schemaSourceString) ? false : watchMode
  }, [])

  return (
    <TaskProvider
      tasks={[
        {
          taskKey: 'base-path',
          include: includeBasePathTask,
          state: basePath,
          render: () => <BasePathTask />
        },
        {
          taskKey: 'schema-location-task',
          include: includeSchemaTask,
          state: schemaSourceString ?? project.clientJson?.contents?.settings?.schemaSource,
          render: () => <SchemaLocationTask project={project} />
        },
        {
          taskKey: 'generate-bundle-task',
          include: includeGenerateBundleTask,
          state: bundlePath,
          render: () => {
            invariant(project instanceof Project, 'Local project is required to generate bundle')

            return <GenerateBundleTask project={project} />
          }
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
    'watch-mode-task': watchMode,
    'generate-bundle-task': bundlePath
  } = tasksToState(taskState.tasks)

  invariant(basePath, 'Base path is required')
  invariant(schemaLocation, 'Schema location is required')
  invariant(typeof watchMode === 'boolean', 'Watch mode is required')
  invariant(bundlePath, 'Bundle path is required')

  return watchMode ? (
    <WatchGenerateTask
      project={project}
      bundlePath={bundlePath}
      schemaSourceString={schemaLocation}
      token={token}
    />
  ) : (
    <RunGenerateTask
      project={project}
      bundlePath={bundlePath}
      schemaSourceString={schemaLocation}
      token={token}
    />
  )
}

type RunGenerateProps = {
  project: Project | RemoteProject
  bundlePath: string
  schemaSourceString: string
  token: string | undefined
}

const RunGenerateTask = ({ project, bundlePath, schemaSourceString, token }: RunGenerateProps) => {
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
        try {
          return generate({
            project,
            bundlePath,
            skmtcRoot: state.skmtcRoot,
            accountName: state.session?.user?.user_metadata?.user_name,
            schemaContents,
            clientSettings: project.clientJson?.contents?.settings,
            token
          })
        } catch (error) {
          console.error(error)

          throw error
        }
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
  bundlePath: string
  schemaSourceString: string
  token: string | undefined
}

const WatchGenerateTask = ({
  project,
  bundlePath,
  schemaSourceString,
  token
}: WatchGenerateProps) => {
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
          bundlePath,
          accountName: state.session?.user?.user_metadata?.user_name,
          skmtcRoot: state.skmtcRoot,
          schemaContents: contents,
          clientSettings: project.clientJson?.contents?.settings,
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
