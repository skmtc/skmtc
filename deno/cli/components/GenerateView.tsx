import { Box, Text, useInput } from 'ink'
import { useSkmtc } from './SkmtcContext.tsx'
import type { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
import { useEffect, useReducer, useState } from 'react'
import { generate, toGenerateStatus } from '../workspaces/generate.ts'
import { match } from 'ts-pattern'
import { Spinner } from '@inkjs/ui'
import chokidar, { type FSWatcher } from 'chokidar'
import invariant from 'tiny-invariant'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { BooleanPrompt } from './BooleanPrompt.tsx'

type GenerateProps = {
  project: Project | RemoteProject
}

type GenerateStateType = 'idle' | 'running'

type GenerateState = {
  state: GenerateStateType
  watchMode: boolean
}

type GenerateAction =
  | {
      type: 'set-state'
      payload: GenerateStateType
    }
  | {
      type: 'set-watch-mode'
      payload: boolean
    }

const generateReducer = (state: GenerateState, action: GenerateAction) => {
  return match(action)
    .with({ type: 'set-state' }, ({ payload }) => ({ ...state, state: payload }))
    .with({ type: 'set-watch-mode' }, ({ payload }) => ({ ...state, watchMode: payload }))

    .exhaustive()
}

export const GenerateView = ({ project }: GenerateProps) => {
  const { state: skmtcState } = useSkmtc()

  const [state, dispatch] = useReducer(generateReducer, {
    state: 'idle',
    watchMode: false
  })

  const { skmtcRoot } = skmtcState

  return match(state)
    .with({ state: 'idle' }, () => (
      <BooleanPrompt
        label="Watch for changes?"
        setValue={value => {
          dispatch({ type: 'set-watch-mode', payload: value })

          dispatch({ type: 'set-state', payload: 'running' })
        }}
      />
    ))

    .with({ state: 'running' }, () => {
      return state.watchMode ? (
        <WatchGenerate skmtcRoot={skmtcRoot} project={project} />
      ) : (
        <RunGenerate skmtcRoot={skmtcRoot} project={project} />
      )
    })
    .exhaustive()
}

type RunGenerateProps = {
  skmtcRoot: SkmtcRoot
  project: Project | RemoteProject
}

const RunGenerate = ({ skmtcRoot, project }: RunGenerateProps) => {
  const { dispatch } = useSkmtc()

  const [run, setRun] = useState(true)

  useEffect(() => {
    if (run) {
      generate({ project, skmtcRoot, interactive: true })
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

type WatchGenerateProps = {
  skmtcRoot: SkmtcRoot
  project: Project | RemoteProject
}

const WatchGenerate = ({ skmtcRoot, project }: WatchGenerateProps) => {
  const { dispatch } = useSkmtc()

  const [run, setRun] = useState(false)

  const { schemaSource } = project.schemaFile

  invariant(schemaSource?.type === 'local', 'Only local schema files can be watched')

  const [watcher, setWatcher] = useState<FSWatcher>(chokidar.watch(schemaSource.path))

  useInput(async (_input, key) => {
    if (key.escape) {
      await watcher.close()

      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
    }
  })

  useEffect(() => {
    if (run) {
      generate({ project, skmtcRoot, interactive: true })
        .catch(error => {
          console.error(error)
        })
        .finally(() => {
          setRun(false)
        })
    }
  }, [run])

  watcher.on('change', () => {
    if (!run) {
      setRun(true)
    }
  })

  return (
    <Box flexDirection="column">
      <Spinner label={`Watching ${schemaSource.path}`} />
      <Text dimColor>Hit 'escape' key to stop.</Text>
    </Box>
  )
}
