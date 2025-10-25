import React, { useEffect, useId } from 'react'
import { Box, Newline, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { match } from 'ts-pattern'
import type { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
type ProjectProps = {
  project: Project | RemoteProject
}

type ProjectActionValue =
  | 'generate-artifacts'
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
  { value: 'generate-artifacts', label: 'Generate artifacts', space: true },
  { value: 'install-generator', label: 'Install generator' },
  { value: 'create-generator', label: 'Create new generator' },
  { value: 'clone-generator', label: 'Clone generator' },
  { value: 'remove-generator', label: 'Remove generator' }
].filter((item): item is ProjectAction => item !== undefined)

export const ProjectView = ({ project }: ProjectProps) => {
  const { dispatch } = useSkmtc()
  const shortcutId = useId()

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

          return (
            <Text color={isSelected ? 'white' : undefined}>
              {label}
              {space && <Newline />}
            </Text>
          )
        }}
        onSelect={item => {
          match(item)
            .with({ value: 'generate-artifacts' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'generate', project }
              })
            })
            .with({ value: 'install-generator' }, () => {
              dispatch({
                type: 'set-view',
                payload: {
                  page: 'install-generator',
                  projectName: project.name,
                  generators: undefined
                }
              })
            })
            .with({ value: 'create-generator' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'create-generator', projectName: project.name }
              })
            })
            .with({ value: 'clone-generator' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'clone-generator', projectName: project.name }
              })
            })
            .with({ value: 'remove-generator' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'remove-generator', projectName: project.name }
              })
            })
            .otherwise(() => {
              throw new Error(`Invalid project action: ${item}`)
            })
        }}
      />
    </Box>
  )
}
