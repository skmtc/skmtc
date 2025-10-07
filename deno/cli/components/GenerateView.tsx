import React from 'react'
import { Box, useInput } from 'ink'
import {
  useSkmtc,
  type ViewStateGenerate,
  type ViewStateGenerateConfirmed
} from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { generate, toGenerateStatus } from '@/workspaces/generate.tsx'
import { match, P } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '@/lib/schema-file.ts'
import { useMemo } from 'react'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { join, relative } from 'node:path'
import { isAbsolute } from '@std/path/is-absolute'
import invariant from 'tiny-invariant'
import { Task, TaskProvider } from './TaskContext.tsx'
import { ConfirmTask } from './ConfirmTask.tsx'
import { toDeployTask } from './DeployTask.tsx'
import { TaskListView } from './TaskListView.tsx'
import type { SchemaSource } from '@/lib/schema-file.ts'
import { StringTask } from './StringTask.tsx'
import { BooleanTask } from './BooleanTask.tsx'

type GenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

export const GenerateView = ({ project, view }: GenerateProps) => {
  const { dispatch, state } = useSkmtc()

  const schemaSource = project.schemaFile?.schemaSource

  const projectPath = useMemo(() => {
    return project instanceof Project ? project.toPath() : null
  }, [project])

  const includeDeployQuestion = useMemo(() => {
    return project instanceof Project && typeof project.clientJson.contents?.projectKey !== 'string'
  }, [])

  const includeSchemaQuestion = useMemo(() => {
    return typeof view.schemaSourceString !== 'string'
  }, [])

  const includeWatchQuestion = useMemo(() => {
    return typeof view.watchMode !== 'boolean'
  }, [])

  const token = state.session?.access_token

  invariant(token, 'Session access token is required')

  const tasks: Task[] = [
    {
      key: 'confirm-deployment-task',
      include: includeDeployQuestion,
      render: () => <ConfirmDeploymentTask project={project} />
    },
    {
      key: 'schema-location-task',
      include: includeSchemaQuestion,
      render: () => <SchemaLocationTask schemaSource={schemaSource} view={view} />
    },
    {
      key: 'watch-mode-task',
      include: includeWatchQuestion,
      render: () => <WatchModeTask project={project} view={view} />
    },
    {
      key: 'generate-view-content-task',
      include: true,
      render: () => <GenerateViewContent project={project} view={view} token={token} />
    }
  ]

  return (
    <TaskProvider
      tasks={tasks}
      leave={() =>
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    >
      <TaskListView />
    </TaskProvider>
  )
}

type WatchModeTaskProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

const WatchModeTask = ({ project, view }: WatchModeTaskProps) => {
  const { dispatch } = useSkmtc()

  return (
    <BooleanTask
      prompt="Watch for changes?"
      projectName={project.name}
      setValue={({ value }) => {
        dispatch({ type: 'set-view', payload: { ...view, watchMode: value } })
      }}
    />
  )
}

type SchemaLocationTaskProps = {
  schemaSource: SchemaSource | null
  view: ViewStateGenerate
}

const SchemaLocationTask = ({ schemaSource, view }: SchemaLocationTaskProps) => {
  const { dispatch } = useSkmtc()

  const absoluteRootPath = toAbsoluteRootPath()
  return (
    <StringTask
      prompt="Input OpenAPI schema path or URL"
      defaultValue={
        schemaSource?.type === 'local' ? relative(absoluteRootPath, schemaSource.path) : undefined
      }
      setValue={value => {
        const isRemote = value.startsWith('http://') || value.startsWith('https://')

        dispatch({
          type: 'set-view',
          payload: {
            ...view,
            schemaSourceString: value,
            watchMode: isRemote ? false : view.watchMode
          }
        })
      }}
    />
  )
}

type GenerateViewContentProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
  token: string
}

const GenerateViewContent = ({ project, view, token }: GenerateViewContentProps) => {
  return match(view)
    .with({ schemaSourceString: P.string, watchMode: P.boolean }, confirmedView => {
      return view.watchMode ? (
        <WatchGenerate project={project} view={confirmedView} token={token} />
      ) : (
        <RunGenerate project={project} view={confirmedView} token={token} />
      )
    })
    .otherwise(() => null)
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
  token: string
}

const RunGenerate = ({ project, view, token }: RunGenerateProps) => {
  const { state, dispatch } = useSkmtc()

  useEffect(() => {
    dispatch({ type: 'set-execution', payload: { type: 'generate', title: `Generating...` } })

    toSchemaContents(view.schemaSourceString)
      .then(schemaContents => {
        return generate({
          project,
          skmtcRoot: state.skmtcRoot,
          accountName: state.session?.user?.user_metadata?.user_name,
          interactive: state.interactive,
          schemaContents,
          clientSettings: project.clientJson?.contents?.settings,
          prettier: project.prettierJson?.contents,
          token
        })
      })
      .then(stats => {
        if (stats) {
          dispatch({ type: 'set-message', payload: toGenerateStatus(stats) })
        }
      })
      .catch(error => {
        console.error(error)
      })
      .finally(() => {
        if (state.interactive) {
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        }

        dispatch({ type: 'set-execution', payload: null })
      })
  }, [])

  return <Box></Box>
}

const toSchemaContents = async (schemaSourceString: string): Promise<string> => {
  const schemaSource = toSchemaSource(schemaSourceString)

  if (schemaSource.type === 'local' && !isAbsolute(schemaSource.path)) {
    schemaSource.path = join(toAbsoluteRootPath(), schemaSource.path)
  }

  const { contents } = await SchemaFile.getFromSource(schemaSource)

  return contents
}

type WatchGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
  token: string
}

const WatchGenerate = ({ project, view, token }: WatchGenerateProps) => {
  const { state, dispatch } = useSkmtc()

  const [watcher, setWatcher] = useState<FSWatcher>()

  useInput(async (_input, key) => {
    if (key.escape) {
      await watcher?.close()

      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
    }
  })

  useEffect(() => {
    setWatcher(chokidar.watch(view.schemaSourceString))

    return () => {
      setWatcher(undefined)
    }
  }, [view.schemaSourceString])

  useEffect(() => {
    if (state.execution?.type === 'generate') {
      SchemaFile.getFromSource(toSchemaSource(view.schemaSourceString))
        .then(({ contents }) => {
          return generate({
            project,
            accountName: state.session?.user?.user_metadata?.user_name,
            skmtcRoot: state.skmtcRoot,
            interactive: state.interactive,
            schemaContents: contents,
            clientSettings: project.clientJson?.contents?.settings,
            prettier: project.prettierJson?.contents,
            token
          })
        })
        .then(stats => {
          if (stats) {
            dispatch({ type: 'set-message', payload: toGenerateStatus(stats) })
          }
        })
        .catch(error => {
          console.error(error)
        })
        .finally(() => {
          dispatch({
            type: 'set-execution',
            payload: {
              type: 'generate:watch',
              title: `Watching ${view.schemaSourceString}`,
              subtitle: `Hit 'escape' key to stop.`
            }
          })
        })
    }
  }, [state.execution?.type])

  useEffect(() => {
    if (watcher) {
      watcher.on('change', () => {
        if (state.execution?.type !== 'generate') {
          dispatch({
            type: 'set-execution',
            payload: {
              type: 'generate',
              title: `Generating...`,
              subtitle: `Hit 'escape' key to stop.`
            }
          })
        }
      })
    }
  }, [watcher])

  return <Box></Box>
}
