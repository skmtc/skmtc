import React from 'react'
import { Box } from 'ink'
import {
  useSkmtc,
  type ViewStateGenerate,
  type ViewStateGenerateConfirmed
} from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { generate, toGenerateMessage } from '@/workspaces/generate.tsx'
import { match, P } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
import { toAbsoluteRootPath, toRelativeRootPath } from '@/lib/to-root-path.ts'
import { join, relative } from 'node:path'
import { isAbsolute } from '@std/path/is-absolute'
import invariant from 'tiny-invariant'
import { type Task, TaskProvider, useTask } from './TaskContext.tsx'
import { ConfirmTask } from './ConfirmTask.tsx'
import { toDeployTask } from './DeployTask.tsx'
import { TaskListView } from './TaskListView.tsx'
import type { SchemaSource } from '@/lib/schema-file.ts'
import { StringTask } from './StringTask.tsx'
import { BooleanTask } from './BooleanTask.tsx'
import { Spinner } from '@inkjs/ui'
import { useShortcut } from './useShortcut.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Text } from 'ink'

type GenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

export const GenerateView = ({ project, view }: GenerateProps) => {
  const { dispatch, state } = useSkmtc()

  const schemaSource = project.schemaFile?.schemaSource

  const includeDeployQuestion = useMemo(() => {
    return project instanceof Project && typeof project.clientJson.contents?.projectKey !== 'string'
  }, [])

  const includeBasePathQuestion = useMemo(() => {
    return typeof project.clientJson.contents?.settings.basePath !== 'string'
  }, [])

  const includeSchemaQuestion = useMemo(() => {
    return typeof view.schemaSourceString !== 'string'
  }, [])

  const includeWatchQuestion = useMemo(() => {
    return typeof view.watchMode !== 'boolean'
  }, [])

  const token = state.session?.access_token

  const tasks: Task[] = [
    {
      key: 'confirm-deployment-task',
      include: includeDeployQuestion,
      render: () => <ConfirmDeploymentTask project={project} />
    },
    {
      key: 'display-output-directory-task',
      include: includeBasePathQuestion,
      render: () => <BasePathTask />
    },
    {
      key: 'schema-location-task',
      include: includeSchemaQuestion,
      render: () => <SchemaLocationTask schemaSource={schemaSource} />
    },
    {
      key: 'watch-mode-task',
      include: includeWatchQuestion,
      render: () => <WatchModeTask />
    },
    {
      key: 'generate-view-content-task',
      include: true,
      render: () => <GenerateTask project={project} token={token} />
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

const BasePathTask = () => {
  const { state, dispatch } = useSkmtc()

  return (
    <StringTask
      prompt="Output directory:"
      defaultValue="./"
      setValue={value => {
        const { view } = state

        invariant(view.page === 'generate', `Expecting view to be "generate", got "${view.page}"`)

        const payload = { ...view, basePath: value }

        dispatch({ type: 'set-view', payload })
      }}
    />
  )
}

const WatchModeTask = () => {
  const { state, dispatch } = useSkmtc()

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

        const isRemote = value.startsWith('http://') || value.startsWith('https://')

        const payload = {
          ...view,
          schemaSourceString: value,
          watchMode: isRemote ? false : view.watchMode
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

  return match(view)
    .with(
      { schemaSourceString: P.string, watchMode: P.boolean, basePath: P.string },
      confirmedView => {
        return view.watchMode ? (
          <WatchGenerateTask project={project} view={confirmedView} token={token} />
        ) : (
          <RunGenerateTask project={project} view={confirmedView} token={token} />
        )
      }
    )
    .otherwise(() => {
      return <Box></Box>
    })
}

type ConfirmDeploymentTaskProps = {
  project: Project | RemoteProject
}

export const ConfirmDeploymentTask = ({ project }: ConfirmDeploymentTaskProps) => {
  return (
    <ConfirmTask
      prompt="This project has not been deployed. Would you like to deploy it now?"
      onConfirm={({ state: taskState, dispatch: taskDispatch }) => {
        if (project instanceof Project) {
          taskDispatch({
            type: 'insert-task',
            payload: {
              task: toDeployTask({ project }),
              index: taskState.currentTask + 1
            }
          })
        }
      }}
    />
  )
}
type RunGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
  token: string | undefined
}

const RunGenerateTask = ({ project, view, token }: RunGenerateProps) => {
  const { state, dispatchMessage } = useSkmtc()
  const { leave } = useTask()

  useShortcut({
    key: 'esc',
    name: project.name,
    action: (input, key) => {
      if (key.escape) {
        leave()
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
          token,
          dispatchMessage
        })
      })
      .then(stats => {
        if (stats) {
          dispatchMessage(toGenerateMessage(stats))
        }
      })
      .catch(error => {
        console.error(error)
      })
      .finally(() => {
        leave()
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
  const { leave } = useTask()
  const [watcher, setWatcher] = useState<FSWatcher>()
  const [activity, setActivity] = useState<Activity>('watching')

  useShortcut({
    key: 'esc',
    name: project.name,
    action: async (input, key) => {
      if (key.escape) {
        await watcher?.close()

        leave()
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
          dispatchMessage,
          schemaContents: contents,
          clientSettings: project.clientJson?.contents?.settings,
          prettier: project.prettierJson?.contents,
          token
        })
      })
      .then(stats => {
        if (stats) {
          dispatchMessage(toGenerateMessage(stats))
        }
      })
      .catch(error => {
        console.error(error)

        dispatchMessage({ error: 'Failed to generate' })
      })
      .finally(() => {
        setActivity('watching')
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
