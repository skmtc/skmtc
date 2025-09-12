import { useState } from 'react'
import { useInput, useApp, Text, Box } from 'ink'

export interface CheckboxOption {
  label: string
  value: string
  checked?: boolean
}

interface InkCheckboxProps {
  message: string
  options: CheckboxOption[]
  onSubmit: (values: string[]) => void
}

export function InkCheckbox({ message, options, onSubmit }: InkCheckboxProps) {
  const { exit } = useApp()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [checkedValues, setCheckedValues] = useState<Set<string>>(
    new Set(options.filter(opt => opt.checked).map(opt => opt.value))
  )

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev: number) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setSelectedIndex((prev: number) => Math.min(options.length - 1, prev + 1))
    } else if (key.return) {
      onSubmit(Array.from(checkedValues))
    } else if (input === ' ') {
      const currentOption = options[selectedIndex]
      setCheckedValues((prev: Set<string>) => {
        const newSet = new Set(prev)
        if (newSet.has(currentOption.value)) {
          newSet.delete(currentOption.value)
        } else {
          newSet.add(currentOption.value)
        }
        return newSet
      })
    } else if (key.escape) {
      exit()
    }
  })

  return (
    <Box flexDirection="column">
      <Text color="cyan">{message}</Text>
      <Text color="gray">Space to select, Enter to submit</Text>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex
        const isChecked = checkedValues.has(option.value)
        const checkbox = isChecked ? '[✓]' : '[ ]'
        const prefix = isSelected ? '> ' : '  '
        
        return (
          <Text key={`checkbox-${index}`} color={isSelected ? 'green' : 'white'}>
            {prefix}{checkbox} {option.label}
          </Text>
        )
      })}
    </Box>
  )
}

// Helper function to maintain Cliffy-like interface
export const Checkbox = {
  prompt: async (options: {
    message: string
    options: CheckboxOption[]
  }): Promise<string[]> => {
    const { render } = await import('ink')
    
    return new Promise<string[]>((resolve) => {
      let unmount: (() => void) | undefined
      
      const handleSubmit = (values: string[]) => {
        unmount?.()
        resolve(values)
      }

      const result = render(
        <InkCheckbox 
          message={options.message}
          options={options.options}
          onSubmit={handleSubmit} 
        />
      )
      unmount = result.unmount
    })
  }
}