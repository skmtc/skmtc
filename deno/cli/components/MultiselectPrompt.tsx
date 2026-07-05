import { Box, Text } from 'ink'
import { MultiSelect } from '@inkjs/ui'
import { useState } from 'react'
import type { Option } from '@/components/types.ts'

type MultiselectPromptProps = {
  prompt: string
  options: Option[]
  setValues: (values: string[]) => void
}

export const MultiselectPrompt = ({ prompt, options, setValues }: MultiselectPromptProps) => {
  const [response, setResponse] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
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
      <MultiSelect
        options={options}
        onChange={values => setResponse(values.join(', '))}
        visibleOptionCount={7}
        onSubmit={values => {
          if (!values.length) {
            console.error('No values selected')

            return
          }

          setValues(values)
          setResponse(values.join(', '))
          setSubmitted(true)
        }}
      />
    </Box>
  )
}
