import React from 'react'
import { Box, Text } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useState } from 'react'

type StringPromptProps = {
  prompt: string
  defaultValue?: string
  setValue: (value: string) => void
}

export const StringPrompt = ({ prompt, defaultValue, setValue }: StringPromptProps) => {
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
      <TextInput
        defaultValue={defaultValue}
        onSubmit={value => {
          setValue(value)
          setResponse(value)
        }}
      />
    </Box>
  )
}
