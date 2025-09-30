import React from 'react'
import { type ViewStateInstallGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Newline, Text, useInput } from 'ink'
import { useState } from 'react'
import { MultiSelect } from '@inkjs/ui'
import { availableGenerators } from '@/available-generators.ts'

type InstallGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateInstallGenerator
}

export const InstallGeneratorView = ({ project }: InstallGeneratorViewProps) => {
  const { dispatch } = useSkmtc()
  const [isExecuting, setIsExecuting] = useState(false)

  const imports = project instanceof Project ? (project.rootDenoJson.contents.imports ?? {}) : {}

  const availableToInstall = availableGenerators
    .filter(item => !imports[item.name])
    .map(({ name }) => `jsr:${name}`)

  useInput((input, key) => {
    if (isExecuting) return

    if (key.escape) {
      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
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
        title: `Installing ${selectedValues.length} generator(s)...`
      }
    })

    if (project instanceof Project) {
      Promise.all(
        selectedValues.map(async generator => {
          await project.installGenerator(
            { moduleName: generator },
            { logSuccess: `Generator "${generator}" installed` }
          )
        })
      )
        .then(() => {
          dispatch({
            type: 'set-message',
            payload: `Installed ${selectedValues.length} generator(s) successfully`
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
  }

  if (availableToInstall.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">All available generators are already installed</Text>
        <Text></Text>
        <Text dimColor>Hit 'escape' key to go back</Text>
      </Box>
    )
  }

  if (isExecuting) {
    return <Box></Box>
  }

  return (
    <Box flexDirection="column">
      <Text>
        Select generators to install
        <Newline />
        <Text dimColor>Space to toggle, Enter to submit, Escape to cancel</Text>
      </Text>
      <Text></Text>

      <MultiSelect
        options={availableToInstall.map(gen => ({
          label: gen,
          value: gen
        }))}
        onSubmit={handleSubmit}
      />
    </Box>
  )
}
