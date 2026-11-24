import { type ViewStateCloneGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import type { Project } from '@/lib/project.ts'
import { Box, Text } from 'ink'
import { useState } from 'react'
import { MultiSelect } from '@inkjs/ui'
import { Spinner } from '@/components/Spinner.tsx'
import { parseModuleName } from '@skmtc/core/parseModuleName'
import { useShortcut } from './useShortcut.tsx'
import { toCloneConflictText } from '@/lib/clone-headless.ts'
import { CoreConflictError } from '@/lib/stack-core.ts'

type CloneGeneratorViewProps = {
  project: Project
  view: ViewStateCloneGenerator
}

export const CloneGeneratorView = ({ project, view }: CloneGeneratorViewProps) => {
  const { dispatch, dispatchMessage } = useSkmtc()
  const [cloning, setCloning] = useState(false)

  const cloneableGenerators = Object.entries(project.rootDenoJson.contents.imports ?? {})
    .filter(([_, source]) => {
      const { scheme, packageName } = parseModuleName(String(source))
      return Boolean(scheme) && packageName.startsWith('gen-')
    })
    .map(([moduleName]) => moduleName)

  useShortcut({
    key: 'esc',
    name: project.name,
    action: (input, key) => {
      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  useShortcut({
    key: 'space',
    name: 'toggle',
    action: (input, key) => {
      // behavior handled in MultiSelect component
    }
  })

  useShortcut({
    key: 'enter',
    name: 'submit',
    action: (input, key) => {
      // behavior handled in MultiSelect component
    }
  })

  const handleSubmit = (selectedValues: string[]) => {
    if (selectedValues.length === 0) {
      dispatchMessage({ error: 'No generators selected' })

      return
    }

    setCloning(true)

    project
      .cloneGenerators({ moduleNames: selectedValues, force: view.force })
      .then(results => {
        const summary =
          results.length > 0 ? results.map(r => `${r.moduleName}@${r.version}`).join(', ') : ''
        dispatchMessage({
          success:
            results.length === 0
              ? `Cloned ${selectedValues.length} generator(s) successfully`
              : `Cloned ${results.length} generator(s) successfully: ${summary}`
        })
      })
      .catch(error => {
        if (error instanceof CoreConflictError) {
          dispatchMessage({
            error: toCloneConflictText({
              error,
              projectName: project.name,
              generators: selectedValues
            })
          })
          return
        }

        console.error(error)

        dispatchMessage({ error: `Failed to clone generator(s)` })
      })
      .finally(() => {
        setCloning(false)
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
  }

  if (cloneableGenerators.length === 0) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text color="yellow">No generators available to clone</Text>
      </Box>
    )
  }

  if (cloning) {
    return <Spinner label="Cloning generators..." />
  }

  return (
    <Box flexDirection="column">
      <Text>Select generators to clone:</Text>

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
