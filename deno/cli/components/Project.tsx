import { Box, Newline, Text } from 'ink'
import SelectInput from 'ink-select-input'
type ProjectProps = {
  projectName: string
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
  { value: 'generate-artifacts-watch', label: 'Generate artifacts (watch)', space: true },

  { value: 'deploy', label: 'Deploy' },
  { value: 'runtime-logs', label: 'View runtime logs', space: true },

  { value: 'install-generator', label: 'Install generator' },
  { value: 'add-generator', label: 'Add generator' },
  { value: 'clone-generator', label: 'Clone generator' },
  { value: 'list-generators', label: 'List generators' },
  { value: 'remove-generator', label: 'Remove generator', space: true },

  { value: 'back-to-home', label: 'Back to home' }
]

export const Project = ({ projectName }: ProjectProps) => {
  return (
    <Box flexDirection="column">
      <Text>Project: {projectName}</Text>
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
      />
    </Box>
  )
}
