import React, { useId } from 'react'
import { TextInput } from '@inkjs/ui'
import { useState } from 'react'
import { useTask } from './TaskContext.tsx'
import { TaskResult } from './TaskResult.tsx'
import { TaskContainer } from './TaskContainer.tsx'

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
      <TaskResult prompt={prompt} key={`${id}-response`}>
        {response}
      </TaskResult>
    )
  }

  return (
    <TaskContainer prompt={prompt} key={`${id}-container`}>
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
