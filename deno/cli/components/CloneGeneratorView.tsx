import React from 'react'
import { type ViewStateCloneGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useState } from 'react'
import { MultiSelect } from '@inkjs/ui'
import { parseModuleName } from '@skmtc/core'
import { getGeneratorsRootDenoJson } from '@/lib/generator.ts'
import { useShortcut } from './useShortcut.tsx'

type CloneGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateCloneGenerator
}

export const CloneGeneratorView = ({ project }: CloneGeneratorViewProps) => {
  const { dispatch } = useSkmtc()
  const [isExecuting, setIsExecuting] = useState(false)

  const cloneableGenerators =
    project instanceof Project
      ? Object.entries(project.rootDenoJson.contents.imports ?? {})
          .filter(([_, source]) => {
            const { scheme, packageName } = parseModuleName(String(source))
            return Boolean(scheme) && packageName.startsWith('gen-')
          })
          .map(([moduleName]) => moduleName)
      : []

  useShortcut({
    label: `'esc' to ${project.name}`,
    action: (input, key) => {
      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  const handleSubmit = (selectedValues: string[]) => {
    if (selectedValues.length === 0) {
      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      return
    }

    setIsExecuting(true)

    dispatch({
      type: 'set-execution',
      payload: {
        type: 'generate',
        title: `Cloning ${selectedValues.length} generator(s)...`
      }
    })

    getGeneratorsRootDenoJson()
      .then(generatorsDenoJson => {
        if (project instanceof Project) {
          return Promise.all(
            selectedValues.map(async generator => {
              await project.cloneGenerator({
                moduleName: generator,
                projectName: project.name,
                generatorsDenoJson
              })
            })
          )
        }
      })
      .then(() => {
        dispatch({
          type: 'set-message',
          payload: {
            success: `Cloned ${selectedValues.length} generator(s) successfully`
          }
        })
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
      .catch(error => {
        console.error(error)
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
      .finally(() => {
        dispatch({ type: 'set-execution', payload: null })
      })
  }

  if (cloneableGenerators.length === 0) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text color="yellow">No generators available to clone</Text>
      </Box>
    )
  }

  if (isExecuting) {
    return <Box></Box>
  }

  return (
    <Box flexDirection="column">
      <Text>Select generators to clone:</Text>
      <Text dimColor>Space to toggle, Enter to submit, Escape to cancel</Text>
      <Text></Text>

      <MultiSelect
        options={cloneableGenerators.map(gen => ({
          label: gen,
          value: gen
        }))}
        onSubmit={handleSubmit}
      />
    </Box>
  )
}
