import { Box, Text } from 'ink'
import { Select } from '@inkjs/ui'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Project } from '../lib/project.ts'
import type { AppState } from './types.ts'
import type { ActionDispatch } from 'react'
import type { AppAction } from './types.ts'
import { runPrompt } from './App.tsx'
import { description as deployDescription } from '../generators/deploy.ts'
import { description as addDescription } from '../generators/add.ts'
import { description as installDescription } from '../generators/install.ts'
import { description as removeDescription } from '../generators/remove.ts'
import { description as listDescription } from '../generators/list.ts'
import { description as cloneDescription } from '../generators/clone.ts'
import { description as workspacesGenerateDescription } from '../workspaces/generate.ts'
import { description as runtimeLogsDescription } from '../workspaces/runtime-logs.ts'

type ProjectViewProps = {
  skmtcRoot: SkmtcRoot
  project: Project
  state: AppState
  dispatch: ActionDispatch<[action: AppAction]>
}

export const ProjectView = ({ skmtcRoot, project, state, dispatch }: ProjectViewProps) => {
  return (
    <Box flexDirection="column">
      <Text>{project.name}</Text>
      <Select
        options={toProjectOptions()}
        onChange={option => {
          if (option === 'home') {
            dispatch({ type: 'set-view', view: { type: 'home' } })
          } else {
            runPrompt({ skmtcRoot, action: option, projectName: project.name, dispatch, state })
          }
        }}
      />
    </Box>
  )
}

const toProjectOptions = () => [
  {
    label: workspacesGenerateDescription,
    value: 'generate'
  },
  {
    label: `${workspacesGenerateDescription} (watch)`,
    value: 'generate:watch'
  },

  {
    label: deployDescription,
    value: 'deploy'
  },
  {
    label: runtimeLogsDescription,
    value: 'runtime-logs'
  },
  {
    label: installDescription,
    value: 'install'
  },
  {
    label: addDescription,
    value: 'add'
  },
  {
    label: cloneDescription,
    value: 'clone'
  },
  {
    label: listDescription,
    value: 'list'
  },
  {
    label: removeDescription,
    value: 'remove'
  },
  { label: 'Back to home screen', value: 'home' }
]
