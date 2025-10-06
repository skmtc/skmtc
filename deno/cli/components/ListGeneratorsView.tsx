import React from 'react'
import { type ViewStateListGenerators, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useShortcut } from './useShortcut.tsx'

type ListGeneratorsViewProps = {
  project: Project | RemoteProject
  view: ViewStateListGenerators
}

export const ListGeneratorsView = ({ project }: ListGeneratorsViewProps) => {
  const { dispatch } = useSkmtc()

  const generators = project instanceof Project ? project.toGeneratorIds() : []

  useShortcut({
    label: `'esc' to ${project.name}`,
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
