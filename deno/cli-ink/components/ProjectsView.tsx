import { Box, Text } from 'ink'
import { Select } from '@inkjs/ui'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { ActionDispatch } from 'react'
import type { AppAction } from './types.ts'
import { useInput } from 'ink'

type ProjectsViewProps = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

export const ProjectsView = ({ skmtcRoot, dispatch }: ProjectsViewProps) => {
  const options = skmtcRoot.projects.map(({ name }) => ({
    label: name,
    value: name
  }))

  useInput((_input, key) => {
    if (key.escape || key.leftArrow) {
      dispatch({ type: 'set-view', view: { type: 'home' } })
    }
  })

  return (
    <Box flexDirection="column">
      <Text dimColor>{`  Select a project to use:`}</Text>
      <Select
        options={options}
        onChange={option => {
          dispatch({ type: 'set-view', view: { type: 'project', projectName: option } })
        }}
        visibleOptionCount={7}
      />
    </Box>
  )
}
