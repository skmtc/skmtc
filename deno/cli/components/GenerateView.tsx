import { Box, Text, useInput } from 'ink'
import {
  useSkmtc,
  type ViewStateGenerate,
  type ViewStateGenerateConfirmed
} from './SkmtcContext.tsx'
import type { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
import { useEffect, useState } from 'react'
import { generate, toGenerateStatus } from '../workspaces/generate.tsx'
import { match, P } from 'ts-pattern'
import { Spinner } from '@inkjs/ui'
import chokidar, { type FSWatcher } from 'chokidar'
import { SchemaFile, toSchemaSource } from '../lib/schema-file.ts'
import { QuestionManager } from './QuestionManager.tsx'

type GenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerate
}

export const GenerateView = ({ project, view }: GenerateProps) => {
  const { dispatch } = useSkmtc()

  const schemaSource = project.schemaFile?.schemaSource

  return match(view)
    .with({ schemaSourceString: P.string, watchMode: P.boolean }, confirmedView => {
      return view.watchMode ? (
        <WatchGenerate project={project} view={confirmedView} />
      ) : (
        <RunGenerate project={project} view={confirmedView} />
      )
    })
    .otherwise(() => (
      <QuestionManager
        questions={[
          // Need add deployment check. See `project.ensureDeployment()`
          {
            type: 'string',
            include: typeof view.schemaSourceString === 'string',
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
            include: typeof view.watchMode === 'boolean',
            prompt: 'Watch for changes?',
            setValue: value => {
              dispatch({ type: 'set-view', payload: { ...view, watchMode: value } })
            }
          }
        ]}
      />
    ))
}

type RunGenerateProps = {
  project: Project | RemoteProject
  view: ViewStateGenerateConfirmed
}

const RunGenerate = ({ project, view }: RunGenerateProps) => {
  const { state, dispatch } = useSkmtc()

  const [run, setRun] = useState(true)

  useEffect(() => {
    if (run) {
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
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
          setRun(false)
        })
    }
  }, [run])

  return <Spinner label="Generating..." />
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

  const [run, setRun] = useState(false)

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
    if (run) {
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
        .catch(error => {
          console.error(error)
        })
        .finally(() => {
          setRun(false)
        })
    }
  }, [run])

  useEffect(() => {
    if (watcher) {
      watcher.on('change', () => {
        if (!run) {
          setRun(true)
        }
      })
    }
  }, [watcher])

  return (
    <Box flexDirection="column">
      <Spinner label={`Watching ${view.schemaSourceString}`} />
      <Text dimColor>Hit 'escape' key to stop.</Text>
    </Box>
  )
}
