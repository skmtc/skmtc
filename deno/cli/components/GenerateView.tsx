import React from 'react'
import { Box } from 'ink'
import {
  useSkmtc,
  type ViewStateGenerate,
  type ViewStateGenerateConfirmed
} from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { generate, toGenerateMessage } from '@/commands/generate.tsx'
import { match, P } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { join, relative } from 'node:path'
import { isAbsolute } from '@std/path/is-absolute'
import invariant from 'tiny-invariant'
import { type Task, TaskProvider, tasksToState, useTask } from './TaskContext.tsx'
import { TaskListView } from './TaskListView.tsx'
import type { SchemaSource } from '@/lib/schema-file.ts'
import { StringTask } from './StringTask.tsx'
import { BooleanTask } from '../tasks/BooleanTask.tsx'
import { Spinner } from '@inkjs/ui'
import { useShortcut } from './useShortcut.tsx'
import { TaskBox } from './TaskBox.tsx'
import { ServerTask } from './ServerTask.tsx'
import console from 'node:console'

type GenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

export const GenerateView = ({ project, view }: GenerateProps) => {
  const { dispatch, state } = useSkmtc()
  const [child, setChild] = useState<Deno.ChildProcess>()

  const schemaSource = project.schemaFile?.schemaSource

  const includeBasePathQuestion = useMemo(() => {
    return typeof project.clientJson.contents?.settings.basePath !== 'string'
  }, [])

  const includeSchemaQuestion = useMemo(() => {
    return typeof view.schemaSourceString !== 'string'
  }, [])

  const includeWatchQuestion = useMemo(() => {
    return typeof view.watchMode !== 'boolean' && !isRemoteSchema(view.schemaSourceString)
  }, [view.schemaSourceString])

  const token = state.session?.access_token

  const tasks: Task[] = [
    {
      taskKey: 'start-server-task',
      include: project instanceof Project,
      state: undefined,
      render: () => <StartServerTask project={project as Project} setChild={setChild} />
    },
    {
      taskKey: 'display-output-directory-task',
      include: includeBasePathQuestion,
      state: undefined,
      render: () => <BasePathTask project={project} />
    },
    {
      taskKey: 'schema-location-task',
      include: includeSchemaQuestion,
      state: undefined,
      render: () => <SchemaLocationTask schemaSource={schemaSource} />
    },
    {
      taskKey: 'watch-mode-task',
      include: includeWatchQuestion,
      state: undefined,
      render: () => <WatchModeTask />
    },
    {
      taskKey: 'generate-view-content-task',
      include: true,
      state: undefined,
      render: () => <GenerateTask project={project} token={token} />
    }
  ]

  return (
    <TaskProvider
      tasks={tasks}
      leave={() => {
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

type BasePathTaskProps = {
  project: Project | RemoteProject
}

const BasePathTask = ({ project }: BasePathTaskProps) => {
  const { state, dispatch } = useSkmtc()

  return (
    <StringTask
      prompt="Output directory:"
      defaultValue="./"
      setValue={async value => {
        const { view } = state

        invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

        if (!project.clientJson.contents) {
          project.clientJson.contents = { settings: { basePath: value } }
        } else {
          project.clientJson.contents.settings.basePath = value
        }

        // TODO handle this in cleanup actions
        await project.clientJson.write()

        const payload = { ...view, basePath: value }

        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

type StartServerTaskProps = {
  project: Project
  setChild: Dispatch<SetStateAction<Deno.ChildProcess | undefined>>
}

const StartServerTask = ({ project, setChild }: StartServerTaskProps) => {
  return <ServerTask project={project} setChild={setChild} />
}

const WatchModeTask = () => {
  const { state, dispatch } = useSkmtc()
  const { dispatch: taskDispatch } = useTask()

  const { view } = state

  invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

  useEffect(() => {
    if (isRemoteSchema(view.schemaSourceString)) {
      taskDispatch({ type: 'increment-current-task' })
    }
  }, [view.schemaSourceString])

  if (isRemoteSchema(view.schemaSourceString)) {
    return null
  }

  return (
    <BooleanTask
      prompt="Watch for changes?"
      setValue={({ value }) => {
        const { view } = state

        invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

        const payload = { ...view, watchMode: value }

        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

type SchemaLocationTaskProps = {
  schemaSource: SchemaSource | null
}

const SchemaLocationTask = ({ schemaSource }: SchemaLocationTaskProps) => {
  const { state, dispatch } = useSkmtc()

  const absoluteRootPath = toAbsoluteRootPath()
  return (
    <StringTask
      prompt="Input OpenAPI schema path or URL"
      defaultValue={
        schemaSource?.type === 'local' ? relative(absoluteRootPath, schemaSource.path) : undefined
      }
      setValue={value => {
        const { view } = state

        invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

        const payload = {
          ...view,
          schemaSourceString: value,
          watchMode: isRemoteSchema(value) ? false : view.watchMode
        }

        dispatch({
          type: 'set-view',
          payload
        })
      }}
    />
  )
}

type GenerateTaskProps = {
  project: Project | RemoteProject
  token: string | undefined
}

const GenerateTask = ({ project, token }: GenerateTaskProps) => {
  const { state } = useSkmtc()

  const { view } = state
  invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

  const basePath = view.basePath ?? project.clientJson.contents?.settings.basePath ?? ''

  return match(view)
    .with({ schemaSourceString: P.string, watchMode: P.boolean }, confirmedView => {
      return view.watchMode ? (
        <WatchGenerateTask
          project={project}
          view={{
            ...confirmedView,
            basePath
          }}
          token={token}
        />
      ) : (
        <RunGenerateTask project={project} view={{ ...confirmedView, basePath }} token={token} />
      )
    })
    .otherwise(() => {
      return <Box></Box>
    })
}

type RunGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
  token: string | undefined
}

const RunGenerateTask = ({ project, view, token }: RunGenerateProps) => {
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
    toSchemaContents(view.schemaSourceString)
      .then(schemaContents => {
        return generate({
          project,
          skmtcRoot: state.skmtcRoot,
          accountName: state.session?.user?.user_metadata?.user_name,
          schemaContents,
          clientSettings: project.clientJson?.contents?.settings,
          prettier: project.prettierJson?.contents,
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
  view: ViewStateGenerateConfirmed
  token: string | undefined
}

const WatchGenerateTask = ({ project, view, token }: WatchGenerateProps) => {
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
    setWatcher(chokidar.watch(view.schemaSourceString))

    return () => {
      setWatcher(undefined)
    }
  }, [view.schemaSourceString])

  useEffect(() => {
    if (activity === 'watching') {
      return
    }

    SchemaFile.getFromSource(toSchemaSource(view.schemaSourceString))
      .then(({ contents }) => {
        return generate({
          project,
          accountName: state.session?.user?.user_metadata?.user_name,
          skmtcRoot: state.skmtcRoot,
          schemaContents: contents,
          clientSettings: project.clientJson?.contents?.settings,
          prettier: project.prettierJson?.contents,
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
