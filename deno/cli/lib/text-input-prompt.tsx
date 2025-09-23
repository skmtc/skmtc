import React from 'react'
import { render, Text, Box, useApp, type Instance } from 'ink'
import { TextInput } from '@inkjs/ui'

interface TextInputPromptOptions {
  message?: string
  default?: string
  suggestions?: string[]
  validate?: (value: string) => boolean | string
  placeholder?: string
}

/**
 * A wrapper around @inkjs/ui TextInput that provides an async interface
 * compatible with the Input.prompt API for text input (non-list) use cases.
 */
export async function textInputPrompt(
  messageOrOptions: string | TextInputPromptOptions
): Promise<string> {
  const options =
    typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions

  let instance: Instance | undefined = undefined
  const done = new Promise<string>(resolve => {
    instance = render(
      <TextInputComponent
        options={options}
        resolve={v => {
          resolve(v)
        }}
      />
    )
  })

  const value = await done

  if (instance) {
    // @ts-expect-error - instance is not typed
    instance?.unmount()

    // // @ts-expect-error - instance is not typed
    // await instance?.waitUntilExit()
  }

  return value
}

type TextInputComponentProps = {
  options: TextInputPromptOptions
  resolve: (value: string) => void
}

const TextInputComponent = ({ options, resolve }: TextInputComponentProps) => {
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleChange = (newValue: string) => {
    setValue(newValue)
  }

  const handleSubmit = () => {
    // Run validation if provided
    if (typeof options.validate === 'function') {
      const result = options.validate(value)
      if (result !== true) {
        const errorMessage = typeof result === 'string' ? result : 'Invalid input'
        setError(errorMessage)
        return
      } else {
        setError(null)
      }
    }

    resolve(value)
  }

  return (
    <Box flexDirection="column">
      {options.message && <Text color="yellow">{options.message}</Text>}

      <Box flexDirection="row">
        <TextInput
          placeholder={options.placeholder || ''}
          defaultValue={options.default || ''}
          suggestions={options.suggestions || []}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </Box>

      {error && <Text color="red">{error}</Text>}
    </Box>
  )
}
