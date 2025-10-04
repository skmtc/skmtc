import React from 'react'
import { type ViewStateRemoveGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import SelectInput from 'ink-select-input'
import { QuestionManager } from '@/components/QuestionManager.tsx'

type RemoveGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateRemoveGenerator
}

export const RemoveGeneratorView = ({ project, view }: RemoveGeneratorViewProps) => {
  const { dispatch, state } = useSkmtc()
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(
    view.generatorName ?? null
  )
  const [confirmed, setConfirmed] = useState(false)

  const generators = project instanceof Project ? project.toGeneratorIds() : []

  useInput((_input, key) => {
    if (key.escape && !selectedGenerator) {
      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
    }
  })

  if (generators.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No generators found to remove</Text>
        <Text></Text>
        <Text dimColor>Hit 'escape' key to go back</Text>
      </Box>
    )
  }

  if (!selectedGenerator) {
    return (
      <Box flexDirection="column">
        <Text>Select generator to remove:</Text>
        <Text dimColor>Hit 'escape' key to go back</Text>
        <Text></Text>
        <SelectInput
          items={generators.map(gen => ({ label: gen, value: gen }))}
          onSelect={item => setSelectedGenerator(item.value)}
        />
      </Box>
    )
  }

  if (!confirmed) {
    return (
      <QuestionManager
        questions={[
          {
            type: 'boolean',
            include: true,
            prompt: `Are you sure you want to remove "${selectedGenerator}"?`,
            setValue: async value => {
              if (value) {
                setConfirmed(true)
              } else {
                dispatch({
                  type: 'set-view',
                  payload: { page: 'project', projectName: project.name }
                })
              }
            }
          }
        ]}
      />
    )
  }

  // Execute removal
  if (project instanceof Project) {
    project
      .removeGenerator(
        { moduleName: selectedGenerator },
        { logSuccess: `Generator "${selectedGenerator}" removed` }
      )
      .then(() => {
        dispatch({
          type: 'set-message',
          payload: {
            main: `Generator "${selectedGenerator}" removed successfully`
          }
        })
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
      .catch(error => {
        console.error(error)
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
  }

  return <Box></Box>
}
