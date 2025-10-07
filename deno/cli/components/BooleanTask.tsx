import React, { useId } from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useTask } from '@/components/TaskContext.tsx'
import { useShortcut } from './useShortcut.tsx'
import { useState } from 'react'
import { TaskAction, TaskState } from '@/components/TaskContext.tsx'
import { Dispatch } from 'react'
import { TaskResult } from './TaskResult.tsx'
import { TaskContainer } from './TaskContainer.tsx'

type BooleanTaskArgs = {
  value: boolean
  state: TaskState
  dispatch: Dispatch<TaskAction>
}

type BooleanTaskProps = {
  prompt: string
  projectName: string
  setValue: ({ state, dispatch }: BooleanTaskArgs) => Promise<void> | void
}

export const BooleanTask = ({ prompt, projectName, setValue }: BooleanTaskProps) => {
  const { state, dispatch, leave } = useTask()
  const [confirmed, setConfirmed] = useState<boolean | null>(null)

  useShortcut({
    label: `'esc' to ${projectName}`,
    action: (input, key) => {
      if (key.escape) {
        leave()
      }
    }
  })

  if (confirmed !== null) {
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
          setConfirmed(value)
          dispatch({ type: 'increment-current-task' })
          setValue({ state, dispatch, value })
        }}
      />
    </TaskContainer>
  )
}
