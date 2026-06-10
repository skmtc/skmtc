import React from 'react'
import { Text } from 'ink'
import { MultiSelect } from '@inkjs/ui'
import { useId, useState } from 'react'
import type { Option } from '@/components/types.ts'
import { TaskBox } from './TaskBox.tsx'
import { TaskContainer } from './TaskContainer.tsx'
import { useShortcut } from './useShortcut.tsx'
import { useTask } from './TaskContext.tsx'

type MultiselectTaskProps = {
  prompt: string
  options: Option[]
  setValues: (values: string[]) => void
}
export const MultiselectTask = ({ prompt, options, setValues }: MultiselectTaskProps) => {
  const { dispatch } = useTask()
  const [response, setResponse] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  useShortcut({
    key: 'space',
    name: 'toggle',
    action: (input, key) => {
      // behavior handled in MultiSelect component
    }
  })

  useShortcut({
    key: 'enter',
    name: 'submit',
    action: (input, key) => {
      // behavior handled in MultiSelect component
    }
  })

  if (submitted) {
    return (
      <TaskBox prompt={prompt} active={false}>
        <Text dimColor>{response}</Text>
      </TaskBox>
    )
  }

  return (
    <TaskContainer prompt={prompt}>
      <MultiSelect
        options={options}
        onChange={values => setResponse(values.join(', '))}
        visibleOptionCount={7}
        onSubmit={values => {
          if (!values.length) {
            setError('No values selected')
            console.error('No values selected')

            return
          }

          setValues(values)
          setResponse(values.join(', '))
          dispatch({ type: 'increment-current-task' })
          setSubmitted(true)
        }}
      />
      {error && <Text color="red">{error}</Text>}
    </TaskContainer>
  )
}
