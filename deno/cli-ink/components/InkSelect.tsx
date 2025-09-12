import { useState } from 'react'
import { useInput, useApp, Text, Box } from 'ink'

export interface SelectOption {
  name?: string
  label?: string
  value: string
}

interface InkSelectProps {
  message: string
  options: SelectOption[]
  onSubmit: (value: string) => void
}

export function InkSelect({ message, options, onSubmit }: InkSelectProps) {
  const { exit } = useApp()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev: number) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setSelectedIndex((prev: number) => Math.min(options.length - 1, prev + 1))
    } else if (key.return) {
      const selected = options[selectedIndex]
      onSubmit(selected.value)
    } else if (key.escape) {
      exit()
    }
  })

  return (
    <Box flexDirection="column">
      <Text color="cyan">{message}</Text>
      {options.map((option, index) => {
        const displayName = option.name || option.label || option.value
        const isSelected = index === selectedIndex
        const prefix = isSelected ? '> ' : '  '
        
        return (
          <Text key={`option-${index}`} color={isSelected ? 'green' : 'white'}>
            {prefix}{displayName}
          </Text>
        )
      })}
    </Box>
  )
}

// Helper function to maintain Cliffy-like interface
export const Select = {
  prompt: async <T extends string>(options: {
    message: string
    options: SelectOption[]
  }): Promise<T> => {
    const { render } = await import('ink')
    
    return new Promise<T>((resolve) => {
      let unmount: (() => void) | undefined
      
      const handleSubmit = (value: string) => {
        unmount?.()
        resolve(value as T)
      }

      const result = render(<InkSelect message={options.message} options={options.options} onSubmit={handleSubmit} />)
      unmount = result.unmount
    })
  },
  
  separator: (text: string) => ({ name: text, value: `separator:${text}` })
}