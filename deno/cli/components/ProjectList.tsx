import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useSkmtc } from './SkmtcContext.tsx'
export const ProjectList = () => {
  const { state, dispatch } = useSkmtc()

  const { projects } = state.skmtcRoot

  return (
    <Box flexDirection="column">
      <SelectInput
        items={projects.map(project => ({
          value: project.name,
          label: project.name
        }))}
        itemComponent={({ label, isSelected }) => {
          return <Text dimColor={!isSelected}>{label}</Text>
        }}
        onSelect={item => {
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: item.value } })
        }}
      />
    </Box>
  )
}
