import React from 'react'
import { type ViewStateInstallGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useState } from 'react'
import { MultiSelect, Spinner } from '@inkjs/ui'
import { useShortcut } from './useShortcut.tsx'
import { useGetGenerators } from './useGetGenerators.ts'

type InstallGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateInstallGenerator
}

export const InstallGeneratorView = ({ project }: InstallGeneratorViewProps) => {
  const { dispatch } = useSkmtc()
  const [installing, setInstalling] = useState(false)

  const imports = project instanceof Project ? (project.rootDenoJson.contents.imports ?? {}) : {}

  const generators = useGetGenerators()

  const availableToInstall = generators
    ?.filter(({ scope, packageName }) => !imports[`@${scope}/${packageName}`])
    .map(({ scope, packageName }) => `jsr:@${scope}/${packageName}`)

  useShortcut({
    label: `'esc' to ${project.name}`,
    action: (input, key) => {
      if (!installing) {
        return
      }

      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  useShortcut({
    label: `'space' to toggle`,
    action: (input, key) => {
      // behaviour handled in MultiSelect component
    }
  })

  useShortcut({
    label: `'enter' to submit`,
    action: (input, key) => {
      // behaviour handled in MultiSelect component
    }
  })

  const handleSubmit = (selectedValues: string[]) => {
    if (selectedValues.length === 0) {
      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      return
    }

    setInstalling(true)

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
            payload: {
              success: `Installed ${selectedValues.length} generator(s) successfully`
            }
          })
        })
        .catch(error => {
          console.error(error)

          dispatch({
            type: 'set-message',
            payload: {
              error: `Failed to install generator(s)`
            }
          })
        })
        .finally(() => {
          setInstalling(false)
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        })
    }
  }

  if (!availableToInstall || availableToInstall.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No generators available to install</Text>
      </Box>
    )
  }

  if (installing) {
    return <Spinner label="Installing generators..." />
  }

  return (
    <Box flexDirection="column">
      <Text>Select generators to install</Text>

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
