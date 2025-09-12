import { useState } from 'react'
import { useInput, useApp, Text, Box } from 'ink'

interface InkInputProps {
  message: string
  defaultValue?: string
  suggestions?: string[]
  validate?: (value: string) => string | boolean
  list?: boolean
  onSubmit: (value: string) => void
}

export function InkInput({ 
  message, 
  defaultValue = '', 
  suggestions = [], 
  validate,
  list = false,
  onSubmit 
}: InkInputProps) {
  const { exit } = useApp()
  const [input, setInput] = useState(defaultValue)
  const [error, setError] = useState<string>('')
  const [suggestionIndex, setSuggestionIndex] = useState(-1)

  const filteredSuggestions = list 
    ? suggestions 
    : suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()))

  useInput((inputChar, key) => {
    if (key.return) {
      if (validate) {
        const result = validate(input)
        if (typeof result === 'string') {
          setError(result)
          return
        } else if (!result) {
          setError('Invalid input')
          return
        }
      }
      onSubmit(input)
    } else if (key.escape) {
      exit()
    } else if (key.backspace || key.delete) {
      setInput((prev: string) => prev.slice(0, -1))
      setError('')
      setSuggestionIndex(-1)
    } else if (key.tab && filteredSuggestions.length > 0) {
      const nextIndex = (suggestionIndex + 1) % filteredSuggestions.length
      setSuggestionIndex(nextIndex)
      setInput(filteredSuggestions[nextIndex])
      setError('')
    } else if (key.upArrow && list && filteredSuggestions.length > 0) {
      const nextIndex = suggestionIndex <= 0 ? filteredSuggestions.length - 1 : suggestionIndex - 1
      setSuggestionIndex(nextIndex)
      setInput(filteredSuggestions[nextIndex])
      setError('')
    } else if (key.downArrow && list && filteredSuggestions.length > 0) {
      const nextIndex = (suggestionIndex + 1) % filteredSuggestions.length
      setSuggestionIndex(nextIndex)
      setInput(filteredSuggestions[nextIndex])
      setError('')
    } else if (inputChar && !key.ctrl && !key.meta) {
      setInput((prev: string) => prev + inputChar)
      setError('')
      setSuggestionIndex(-1)
    }
  })

  return (
    <Box flexDirection="column">
      <Text color="cyan">{message}</Text>
      <Box>
        <Text color="gray">{'> '}</Text>
        <Text>{input}</Text>
        <Text color="gray">{'_'}</Text>
      </Box>
      {error && <Text color="red">{error}</Text>}
      {list && filteredSuggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {filteredSuggestions.map((suggestion, index) => (
            <Text 
              key={`suggestion-${index}`}
              color={index === suggestionIndex ? 'green' : 'gray'}
              dimColor={index !== suggestionIndex}
            >
              {suggestion}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

// Helper function to maintain Cliffy-like interface
export const Input = {
  prompt: async (options: {
    message: string
    default?: string
    suggestions?: string[]
    validate?: (value: string) => string | boolean
    list?: boolean
  }): Promise<string> => {
    const { render } = await import('ink')
    
    return new Promise<string>((resolve) => {
      let unmount: (() => void) | undefined
      
      const handleSubmit = (value: string) => {
        unmount?.()
        resolve(value)
      }

      const result = render(
        <InkInput 
          message={options.message}
          defaultValue={options.default}
          suggestions={options.suggestions}
          validate={options.validate}
          list={options.list}
          onSubmit={handleSubmit} 
        />
      )
      unmount = result.unmount
    })
  }
}