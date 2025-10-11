import React from 'react'
import { type ViewStateRemoveGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useState } from 'react'
import SelectInput from 'ink-select-input'
import { useShortcut } from './useShortcut.tsx'
import { ConfirmInput } from '@inkjs/ui'

type RemoveGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateRemoveGenerator
}

export const RemoveGeneratorView = ({ project, view }: RemoveGeneratorViewProps) => {
  const { dispatch, dispatchMessage } = useSkmtc()
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(
    view.generatorName ?? null
  )
  const [confirmed, setConfirmed] = useState(false)

  const generators = project instanceof Project ? project.toGeneratorIds() : []

  useShortcut({
    key: 'esc',
    name: project.name,
    action: (input, key) => {
      if (key.escape && !selectedGenerator) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  if (generators.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No generators found to remove</Text>
      </Box>
    )
  }

  if (!selectedGenerator) {
    return (
      <Box flexDirection="column">
        <Text>Select generator to remove:</Text>

        <SelectInput
          items={generators.map(gen => ({ label: gen, value: gen }))}
          onSelect={item => setSelectedGenerator(item.value)}
        />
      </Box>
    )
  }

  if (!confirmed) {
    return (
      <Box flexDirection="column">
        <Text>Are you sure you want to remove "{selectedGenerator}"?</Text>
        <ConfirmInput
          onConfirm={() => {
            setConfirmed(true)
          }}
          onCancel={() => {
            dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
          }}
        />
      </Box>
    )
  }

  // Execute removal
  if (project instanceof Project) {
    project
      .removeGenerator({ moduleName: selectedGenerator })
      .then(() => {
        dispatchMessage({ success: `Generator "${selectedGenerator}" removed successfully` })
      })
      .catch(error => {
        console.error(error)

        dispatchMessage({ error: `Failed to remove generator "${selectedGenerator}"` })
      })
      .finally(() => {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
  }

  return <Box></Box>
}
