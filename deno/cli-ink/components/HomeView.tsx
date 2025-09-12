import { Box, Text } from 'ink'
import { type Option, Select } from '@inkjs/ui'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { AppState } from './types.ts'
import type { ActionDispatch } from 'react'
import type { AppAction } from './types.ts'
import { match } from 'ts-pattern'

type HomeViewProps = {
  skmtcRoot: SkmtcRoot
  state: AppState
  dispatch: ActionDispatch<[action: AppAction]>
}

type ToHomeOptionsArgs = {
  state: AppState
  skmtcRoot: SkmtcRoot
}

const toHomeOptions = ({ state, skmtcRoot }: ToHomeOptionsArgs) => {
  const initial: Option[] = []

  if (skmtcRoot.projects.length) {
    initial.push({
      label: 'Select a project',
      value: 'select-project'
    })
  }

  return [
    ...initial,
    {
      label: 'Create new project',
      value: 'init'
    },
    {
      label: state.user ? 'Log out' : 'Log in to Skmtc',
      value: state.user ? 'logout' : 'login'
    },
    {
      label: 'Exit',
      value: 'exit'
    }
  ]
}

export const HomeView = ({ skmtcRoot, state, dispatch }: HomeViewProps) => {
  return (
    <Box flexDirection="column">
      <Text dimColor>{`  To get started, select an option below`}</Text>

      <Select
        options={toHomeOptions({ state, skmtcRoot })}
        onChange={option => {
          match(option)
            .with('select-project', () =>
              dispatch({ type: 'set-view', view: { type: 'projects' } })
            )
            .with('init', () => {
              dispatch({ type: 'set-view', view: { type: 'create-project' } })
            })
            .with('login', () => {
              dispatch({ type: 'set-view', view: { type: 'login' } })
            })
            .with('logout', async () => {
              await skmtcRoot.logout({ notify: alert => dispatch({ type: 'set-alert', alert }) })

              dispatch({ type: 'set-user', user: null })
            })
            .with('exit', () => Deno.exit(0))
            .otherwise(() => {
              // do nothing
            })
        }}
        visibleOptionCount={7}
      />
    </Box>
  )
}
