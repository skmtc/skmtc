import { Box, Text } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useState } from 'react'

type NumberPromptProps = {
  prompt: string
  setValue: (value: number) => void
}

export const NumberPrompt = ({ prompt, setValue }: NumberPromptProps) => {
  const [response, setResponse] = useState<number | null>(null)

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
        onSubmit={value => {
          const number = Number(value)

          if (!isNaN(number)) {
            setValue(number)
            setResponse(number)
          }
        }}
      />
    </Box>
  )
}
