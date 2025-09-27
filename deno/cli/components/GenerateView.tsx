import { Box, Text, useInput } from 'ink'
import { useSkmtc } from './SkmtcContext.tsx'
import type { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
import SelectInput from 'ink-select-input'
import { useEffect, useReducer, useState } from 'react'
import { generate } from '../workspaces/generate.ts'
import { match } from 'ts-pattern'
import { Spinner } from '@inkjs/ui'
import chokidar, { type FSWatcher } from 'chokidar'
import invariant from 'tiny-invariant'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

type GenerateProps = {
  project: Project | RemoteProject
}

type GenerateStateType = 'idle' | 'running' | 'completed' | 'failed'

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
  const { state: skmtcState, dispatch: skmtcDispatch } = useSkmtc()

  const [state, dispatch] = useReducer(generateReducer, {
    state: 'idle',
    watchMode: false
  })

  const { skmtcRoot } = skmtcState

  console.log('STATE', state)
  console.log('WATCH MODE', state.watchMode)

  return match(state)
    .with({ state: 'idle' }, () => (
      <BooleanPrompt
        label="Watch for changes?"
        setValue={value => {
          console.log('SET VALUE', value)

          dispatch({ type: 'set-watch-mode', payload: value })

          dispatch({ type: 'set-state', payload: 'running' })
        }}
      />
    ))

    .with({ state: 'running' }, () => {
      return state.watchMode ? (
        <WatchGenerate skmtcRoot={skmtcRoot} project={project} />
      ) : (
        <Spinner label="Generating..." />
      )
    })
    .with({ state: 'completed' }, () => <Text>Completed</Text>)
    .with({ state: 'failed' }, () => <Text>Failed</Text>)
    .exhaustive()
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
      generate({ project, skmtcRoot, watching: true })
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

type BooleanPromptProps = {
  label: string
  setValue: (value: boolean) => void
}

const BooleanPrompt = ({ label, setValue }: BooleanPromptProps) => {
  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <SelectInput
        items={[
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]}
        onSelect={({ value }) => {
          setValue(value)
        }}
      />
    </Box>
  )
}
