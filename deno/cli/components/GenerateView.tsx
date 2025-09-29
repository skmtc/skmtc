import { Box, useInput } from 'ink'
import {
  useSkmtc,
  type ViewStateGenerate,
  type ViewStateGenerateConfirmed
} from './SkmtcContext.tsx'
import { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { generate, toGenerateStatus } from '../workspaces/generate.tsx'
import { match, P } from 'ts-pattern'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '../lib/schema-file.ts'
import { QuestionManager } from './QuestionManager.tsx'
import { useMemo } from 'react'

type GenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

export const GenerateView = ({ project, view }: GenerateProps) => {
  const { dispatch } = useSkmtc()

  const schemaSource = project.schemaFile?.schemaSource

  const includeDeployQuestion = useMemo(() => {
    return project instanceof Project && typeof project.clientJson.contents?.projectKey !== 'string'
  }, [])

  const includeSchemaQuestion = useMemo(() => {
    return typeof view.schemaSourceString !== 'string'
  }, [])

  const includeWatchQuestion = useMemo(() => {
    return typeof view.watchMode !== 'boolean'
  }, [])

  return (
    <>
      <QuestionManager
        questions={[
          {
            type: 'boolean',
            include: includeDeployQuestion,
            prompt: 'This project has not been deployed. Would you like to deploy it now?',
            setValue: async value => {
              if (project instanceof Project && value === true) {
                await project.deploy({ logSuccess: 'Generators deployed', dispatch })
              }
            }
          },
          {
            type: 'string',
            include: includeSchemaQuestion,
            prompt: 'Path or URL for input OpenAPI schema',
            defaultValue: schemaSource?.type === 'local' ? schemaSource.path : undefined,
            setValue: value => {
              const isRemote = value.startsWith('http://') || value.startsWith('https://')

              dispatch({
                type: 'set-view',
                payload: {
                  ...view,
                  schemaSourceString: value,
                  watchMode: isRemote ? false : view.watchMode
                }
              })
            }
          },
          {
            type: 'boolean',
            include: includeWatchQuestion,
            prompt: 'Watch for changes?',
            setValue: value => {
              dispatch({ type: 'set-view', payload: { ...view, watchMode: value } })
            }
          }
        ]}
      />
      <GenerateViewContent project={project} view={view} />
    </>
  )
}

type GenerateViewContentProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

const GenerateViewContent = ({ project, view }: GenerateViewContentProps) => {
  return match(view)
    .with({ schemaSourceString: P.string, watchMode: P.boolean }, confirmedView => {
      return view.watchMode ? (
        <WatchGenerate project={project} view={confirmedView} />
      ) : (
        <RunGenerate project={project} view={confirmedView} />
      )
    })
    .otherwise(() => null)
}

type RunGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
}

const RunGenerate = ({ project, view }: RunGenerateProps) => {
  const { state, dispatch } = useSkmtc()

  useEffect(() => {
    dispatch({ type: 'set-execution', payload: { type: 'generate', title: `Generating...` } })

    toSchemaContents(view.schemaSourceString)
      .then(schemaContents => {
        return generate({
          project,
          skmtcRoot: state.skmtcRoot,
          interactive: state.interactive,
          schemaContents,
          clientSettings: project.clientJson?.contents?.settings,
          prettier: project.prettierJson?.contents
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
  const { contents } = await SchemaFile.getFromSource(schemaSource)

  return contents
}

type WatchGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
}

const WatchGenerate = ({ project, view }: WatchGenerateProps) => {
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
            skmtcRoot: state.skmtcRoot,
            interactive: state.interactive,
            schemaContents: contents,
            clientSettings: project.clientJson?.contents?.settings,
            prettier: project.prettierJson?.contents
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
