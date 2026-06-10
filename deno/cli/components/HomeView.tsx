import React from 'react'
import SelectInput from 'ink-select-input'
import { Box, Newline, Text } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'

type HomeActionType = `select-project:${string}` | 'create-project' | 'exit'

type HomeActionItem = {
  value: HomeActionType
  space?: boolean
  label: string
}

export const HomeView = () => {
  const { state, dispatch, exit } = useSkmtc()

  const { skmtcRoot } = state
  const { projects } = skmtcRoot

  const projectOptions: HomeActionItem[] = projects
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(({ name }, index, array) => ({
      value: `select-project:${name}`,
      label: name,
      space: index === array.length - 1
    }))

  const items: HomeActionItem[] = [
    ...projectOptions,
    { value: 'create-project', label: 'Create new project', space: true },
    { value: 'exit', label: 'Exit' }
  ]

  return (
    <Box flexDirection="column">
      {projects.length > 0 && (
        <Box marginLeft={2}>
          <Text>Select a project</Text>
        </Box>
      )}
      <SelectInput
        items={items}
        itemComponent={({ label, isSelected, ...props }) => {
          const space = 'space' in props ? Boolean(props.space) : false
          const isProject =
            'value' in props &&
            typeof props.value === 'string' &&
            props.value.startsWith('select-project:')

          return (
            <Text color={isSelected ? 'white' : undefined} dimColor={!isSelected && isProject}>
              {label}
              {space && <Newline />}
            </Text>
          )
        }}
        onSelect={async item => {
          if (typeof item.value === 'string' && item.value.startsWith('select-project:')) {
            dispatch({ type: 'set-view', payload: { page: 'project', projectName: item.label } })
          } else if (item.value === 'create-project') {
            dispatch({ type: 'set-view', payload: { page: 'create-project' } })
          } else if (item.value === 'exit') {
            exit()
          }
        }}
      />
    </Box>
  )
}
