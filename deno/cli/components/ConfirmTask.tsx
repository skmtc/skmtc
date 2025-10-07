import React, { ReactNode, useId } from 'react'
import SelectInput from 'ink-select-input'
import { useTask } from '@/components/TaskContext.tsx'
import { useState } from 'react'
import { TaskAction, TaskState } from '@/components/TaskContext.tsx'
import { Dispatch } from 'react'
import { TaskResult } from './TaskResult.tsx'
import { TaskContainer } from './TaskContainer.tsx'

type ConfirmTaskArgs = {
  state: TaskState
  dispatch: Dispatch<TaskAction>
}

type ConfirmTaskProps = {
  prompt: string
  onConfirm: ({ state, dispatch }: ConfirmTaskArgs) => Promise<void> | void
}

export const ConfirmTask = ({ prompt, onConfirm }: ConfirmTaskProps) => {
  const { state, dispatch, leave } = useTask()
  const [confirmed, setConfirmed] = useState(false)

  if (confirmed) {
    return <TaskResult prompt={prompt}>{confirmed ? 'Yes' : 'No'}</TaskResult>
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
