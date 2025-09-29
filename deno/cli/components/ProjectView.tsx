import { Box, Newline, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useSkmtc } from './SkmtcContext.tsx'
import { match } from 'ts-pattern'
import type { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
type ProjectProps = {
  project: Project | RemoteProject
}

type ProjectActionValue =
  | 'generate-artifacts'
  | 'generate-artifacts-watch'
  | 'deploy'
  | 'runtime-logs'
  | 'install-generator'
  | 'add-generator'
  | 'clone-generator'
  | 'list-generators'
  | 'remove-generator'
  | 'back-to-home'

type ProjectAction = {
  value: ProjectActionValue
  space?: boolean
  label: string
}

const projectActions: ProjectAction[] = [
  { value: 'generate-artifacts', label: 'Generate artifacts' },

  { value: 'deploy', label: 'Deploy' },
  { value: 'runtime-logs', label: 'View runtime logs', space: true },

  { value: 'install-generator', label: 'Install generator' },
  { value: 'add-generator', label: 'Add generator' },
  { value: 'clone-generator', label: 'Clone generator' },
  { value: 'list-generators', label: 'List generators' },
  { value: 'remove-generator', label: 'Remove generator', space: true },

  { value: 'back-to-home', label: 'Back to home' }
]

export const ProjectView = ({ project }: ProjectProps) => {
  const { state, dispatch } = useSkmtc()

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
            .with({ value: 'back-to-home' }, () => {
              dispatch({ type: 'set-view', payload: { page: 'home' } })
            })
            .with({ value: 'generate-artifacts' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'generate', projectName: project.name }
              })
            })
            .with({ value: 'deploy' }, () => {
              dispatch({
                type: 'set-view',
                payload: { page: 'deploy', projectName: project.name }
              })
            })
            .otherwise(() => {
              console.log(item)
            })
        }}
      />
    </Box>
  )
}
