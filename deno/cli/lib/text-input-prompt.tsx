import React from 'react'
import { render } from 'ink'
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

  return new Promise((resolve, reject) => {
    let inputValue = options.default || ''
    let isSubmitted = false

    const TextInputComponent = () => {
      const [value, setValue] = React.useState(inputValue)
      const [error, setError] = React.useState<string | null>(null)

      const handleChange = (newValue: string) => {
        setValue(newValue)
        inputValue = newValue

        // Clear error on change
        if (error) {
          setError(null)
        }
      }

      const handleSubmit = () => {
        if (isSubmitted) return

        // Run validation if provided
        if (options.validate) {
          const result = options.validate(inputValue)
          if (result !== true) {
            const errorMessage = typeof result === 'string' ? result : 'Invalid input'
            setError(errorMessage)
            return
          }
        }

        isSubmitted = true
        resolve(inputValue)
      }

      return (
        <>
          {options.message && <div style={{ marginBottom: 1 }}>{options.message}</div>}

          {error && <div style={{ color: 'red', marginBottom: 1 }}>{error}</div>}

          <TextInput
            placeholder={options.placeholder || ''}
            defaultValue={options.default || ''}
            suggestions={options.suggestions || []}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        </>
      )
    }

    try {
      const app = render(<TextInputComponent />)

      // Handle cleanup if needed
      app.waitUntilExit().catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}
