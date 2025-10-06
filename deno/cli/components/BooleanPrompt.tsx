import React from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useState } from 'react'
import { useTask } from '@/components/TaskContext.tsx'

type BooleanPromptProps = {
  prompt: string
  setValue: (value: boolean) => void
}

export const BooleanPrompt = ({ prompt, setValue }: BooleanPromptProps) => {
  const [response, setResponse] = useState<boolean | null>(null)
  const { dispatch } = useTask()

  if (response !== null) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text>{prompt}</Text>
        <Text dimColor>{response ? 'Yes' : 'No'}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text>{prompt}</Text>
      <SelectInput
        items={[
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]}
        onSelect={({ value }) => {
          setValue(value)
          setResponse(value)
        }}
      />
    </Box>
  )
}
