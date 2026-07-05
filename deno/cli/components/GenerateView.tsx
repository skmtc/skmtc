import { useSkmtc } from '@/components/SkmtcContext.tsx'
import type { Project } from '@/lib/project.ts'
import { useEffect, useState } from 'react'
import { toGenerateMessage } from '@/commands/generate.tsx'
import { generate } from '@/lib/generate.ts'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
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
import { SchemaLocationTask } from '@/tasks/SchemaLocationTask.tsx'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { join } from '@std/path/join'
import { GenerateWorkerTask } from '../tasks/GenerateWorkerTask.tsx'
import { toWorkerPath } from '../lib/to-worker-path.ts'

type GenerateProps = {
  project: Project
  schemaSourceString: string | undefined
  watchMode: boolean | undefined
}

export const GenerateView = ({ project, schemaSourceString, watchMode }: GenerateProps) => {
  const { dispatch, state } = useSkmtc()

  const basePath = useMemo(() => {
    return project.clientJson?.contents?.settings.basePath
  }, [])

  const includeSchemaTask = useMemo(() => {
    return typeof schemaSourceString !== 'string' && !project.clientJson?.contents?.source
  }, [])

  const includeGenerateWorkerTask = useMemo(() => {
    const workerPath = join(project.toPath(), 'worker.ts')

    return !existsSync(workerPath)
  }, [])

  const workerPath = useMemo(() => {
    const workerPath = toWorkerPath(project.toPath())

    return existsSync(workerPath) ? workerPath : undefined
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
          include: typeof basePath !== 'string',
          state: basePath,
          render: () => <BasePathTask />
        },
        {
          taskKey: 'schema-location-task',
          include: includeSchemaTask,
          state: schemaSourceString ?? project.clientJson?.contents?.source,
          render: () => <SchemaLocationTask project={project} />
        },
        {
          taskKey: 'generate-worker-task',
          include: includeGenerateWorkerTask,
          state: workerPath,
          render: () => <GenerateWorkerTask project={project} />
        },
        {
          taskKey: 'generate-bundle-task',
          include: true,
          state: undefined,
          render: () => <GenerateBundleTask project={project} />
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

type GenerateTaskProps = {
  project: Project
}

const GenerateTask = ({ project }: GenerateTaskProps) => {
  const { state: taskState } = useTask()

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
    />
  ) : (
    <RunGenerateTask project={project} bundlePath={bundlePath} schemaSourceString={schemaLocation} />
  )
}

type RunGenerateProps = {
  project: Project
  bundlePath: string
  schemaSourceString: string
}

const RunGenerateTask = ({ project, bundlePath, schemaSourceString }: RunGenerateProps) => {
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
            schemaContents: schemaContents.contents,
            fileType: schemaContents.fileType,
            clientSettings: project.clientJson?.contents?.settings
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
    <TaskBox active>
      <Spinner label="Generating..." />
    </TaskBox>
  )
}

type Activity = 'watching' | 'generating'

type WatchGenerateProps = {
  project: Project
  bundlePath: string
  schemaSourceString: string
}

const WatchGenerateTask = ({ project, bundlePath, schemaSourceString }: WatchGenerateProps) => {
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
      .then(({ contents, fileType }) => {
        return generate({
          project,
          bundlePath,
          skmtcRoot: state.skmtcRoot,
          schemaContents: contents,
          fileType,
          clientSettings: project.clientJson?.contents?.settings
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
    <TaskBox active>
      <Spinner label={activity === 'generating' ? 'Generating...' : 'Watching...'} />
    </TaskBox>
  )
}
