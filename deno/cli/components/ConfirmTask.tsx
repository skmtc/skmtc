import React, { useId } from 'react'
import SelectInput from 'ink-select-input'
import { useTask } from '@/components/TaskContext.tsx'
import { useState } from 'react'
import type { TaskAction, TaskContextState } from '@/components/TaskContext.tsx'
import type { Dispatch } from 'react'
import { TaskContainer } from './TaskContainer.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Text } from 'ink'

type ConfirmTaskArgs = {
  state: TaskContextState
  dispatch: Dispatch<TaskAction>
}

type ConfirmTaskProps = {
  prompt: string
  onConfirm: ({ state, dispatch }: ConfirmTaskArgs) => Promise<void> | void
}

export const ConfirmTask = ({ prompt, onConfirm }: ConfirmTaskProps) => {
  const { state, dispatch, leave } = useTask()
  const [confirmed, setConfirmed] = useState(false)
  const id = useId()

  if (confirmed) {
    return (
      <TaskBox prompt={prompt} id={`${id}-result`} active={false}>
        <Text dimColor>Yes</Text>
      </TaskBox>
    )
  }

  return (
    <TaskContainer prompt={prompt}>
      <SelectInput
        items={[
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]}
        onSelect={({ value }) => {
          if (value) {
            setConfirmed(value)
            dispatch({ type: 'increment-current-task' })
            onConfirm({ state, dispatch })
          } else {
            leave()
          }
        }}
      />
    </TaskContainer>
  )
}
