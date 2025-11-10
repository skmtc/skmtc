import React, { useEffect, useId, useMemo } from 'react'
import { Box, Newline, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { existsSync } from '@std/fs/exists'
import { toBundlePath } from '@/lib/to-bundle-path.ts'
import { join } from '@std/path/join'
type ProjectProps = {
  project: Project | RemoteProject
}

type ProjectActionValue =
  | 'generate-artifacts'
  | 'bundle'
  | 'generate-artifacts-watch'
  | 'deploy'
  | 'serve'
  | 'runtime-logs'
  | 'install-generator'
  | 'create-generator'
  | 'clone-generator'
  | 'list-generators'
  | 'remove-generator'

type ProjectAction = {
  value: ProjectActionValue
  space?: boolean
  label: string
}

const projectActions: ProjectAction[] = [
  { value: 'generate-artifacts', label: 'Generate artifacts' },
  { value: 'bundle', label: 'Bundle', space: true },
  { value: 'install-generator', label: 'Install generator' },
  { value: 'create-generator', label: 'Create new generator' },
  { value: 'clone-generator', label: 'Clone generator' },
  { value: 'remove-generator', label: 'Remove generator' }
].filter((item): item is ProjectAction => item !== undefined)

export const ProjectView = ({ project }: ProjectProps) => {
  const { dispatch } = useSkmtc()
  const shortcutId = useId()

  const hasBundleFile = useMemo(() => {
    if (project instanceof Project) {
      return existsSync(join(project.toPath(), 'bundle.js'))
    }
    return false
  }, [])

  useEffect(() => {
    dispatch({
      type: 'add-shortcut',
      payload: {
        id: shortcutId,
        label: `'esc' to home`,
        action: (_input, key) => {
          if (key.escape) {
            dispatch({ type: 'set-view', payload: { page: 'home' } })
          }
        }
      }
    })

    return () => {
      dispatch({ type: 'remove-shortcut', payload: shortcutId })
    }
  }, [])

  return (
    <Box flexDirection="column">
      <SelectInput<ProjectActionValue>
        items={projectActions}
        itemComponent={({ label, isSelected, ...props }) => {
          const space = 'space' in props && typeof props.space === 'boolean' ? props.space : false
          const isGenerateArtifacts = 'value' in props && props.value === 'generate-artifacts'
          const shouldDim = isGenerateArtifacts && !hasBundleFile

          return (
            <Text color={isSelected ? 'white' : undefined} dimColor={shouldDim}>
              {label}
              {space && <Newline />}
            </Text>
          )
        }}
        onSelect={item => {
          switch (item.value) {
            case 'generate-artifacts': {
              if (!hasBundleFile) {
                return
              }
              dispatch({
                type: 'set-view',
                payload: { page: 'generate', project }
              })
              break
            }
            case 'bundle': {
              dispatch({
                type: 'set-view',
                payload: { page: 'bundle', projectName: project.name }
              })
              break
            }
            case 'install-generator': {
              dispatch({
                type: 'set-view',
                payload: {
                  page: 'install-generator',
                  projectName: project.name,
                  generators: undefined
                }
              })
              break
            }
            case 'create-generator': {
              dispatch({
                type: 'set-view',
                payload: { page: 'create-generator', projectName: project.name }
              })
              break
            }
            case 'clone-generator': {
              dispatch({
                type: 'set-view',
                payload: { page: 'clone-generator', projectName: project.name }
              })
              break
            }
            case 'remove-generator': {
              dispatch({
                type: 'set-view',
                payload: { page: 'remove-generator', projectName: project.name }
              })
              break
            }
            default: {
              throw new Error(`Invalid project action: ${item}`)
            }
          }
        }}
      />
    </Box>
  )
}
