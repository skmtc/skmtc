import React, { useId } from 'react'
import { TextInput } from '@inkjs/ui'
import { useState } from 'react'
import { useTask } from './TaskContext.tsx'
import { TaskContainer } from './TaskContainer.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Text } from 'ink'

type StringTaskProps = {
  prompt: string
  defaultValue?: string
  setValue: (value: string) => void
}

export const StringTask = ({ prompt, defaultValue, setValue }: StringTaskProps) => {
  const { dispatch } = useTask()
  const [response, setResponse] = useState<string | null>(null)
  const id = useId()

  if (response !== null) {
    return (
      <TaskBox prompt={prompt} id={`${id}-response`} active={false}>
        <Text dimColor>{response}</Text>
      </TaskBox>
    )
  }

  return (
    <TaskContainer prompt={prompt}>
      <TextInput
        defaultValue={defaultValue}
        onSubmit={value => {
          setResponse(value)
          dispatch({ type: 'increment-current-task' })
          setValue(value)
        }}
      />
    </TaskContainer>
  )
}
