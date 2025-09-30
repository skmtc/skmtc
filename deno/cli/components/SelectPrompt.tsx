import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useState } from 'react'
import type { Option } from '@/components/types.ts'

type SelectPromptProps = {
  prompt: string
  options: Option[]
  setValue: (value: string) => void
}

export const SelectPrompt = ({ prompt, options, setValue }: SelectPromptProps) => {
  const [response, setResponse] = useState<string | null>(null)

  if (response !== null) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text>{prompt}</Text>
        <Text dimColor>{response}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text>{prompt}</Text>
      <SelectInput
        items={options}
        onSelect={item => {
          setValue(item.value)
          setResponse(item.value)
        }}
      />
    </Box>
  )
}
