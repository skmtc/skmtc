import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

type BooleanPromptProps = {
  label: string
  setValue: (value: boolean) => void
}

export const BooleanPrompt = ({ label, setValue }: BooleanPromptProps) => {
  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <SelectInput
        items={[
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]}
        onSelect={({ value }) => {
          setValue(value)
        }}
      />
    </Box>
  )
}
