import React from 'react'
import { type ViewStateListGenerators, useSkmtc } from '@/components/SkmtcContext.tsx'
import type { Project } from '@/lib/project.ts'
import { Box, Text } from 'ink'
import { useShortcut } from './useShortcut.tsx'

type ListGeneratorsViewProps = {
  project: Project
  view: ViewStateListGenerators
}

export const ListGeneratorsView = ({ project }: ListGeneratorsViewProps) => {
  const { dispatch } = useSkmtc()

  const generators = project.toGeneratorIds()

  useShortcut({
    key: 'esc',
    name: project.name,
    action: (input, key) => {
      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Generators in {project.name}:</Text>
      <Text></Text>

      {generators.length === 0 ? (
        <Text dimColor>No generators found</Text>
      ) : (
        generators.map(generator => <Text key={generator}> • {generator}</Text>)
      )}
    </Box>
  )
}
