import React, { useId } from 'react'
import SelectInput from 'ink-select-input'
import { useTask } from '@/components/TaskContext.tsx'
import { useShortcut } from './useShortcut.tsx'
import { useState } from 'react'
import type { TaskAction, TaskState } from '@/components/TaskContext.tsx'
import type { Dispatch } from 'react'
import { TaskContainer } from './TaskContainer.tsx'
import { TaskBox } from './TaskBox.tsx'
import { Text } from 'ink'

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
  const id = useId()

  useShortcut({
    label: `'esc' to ${projectName}`,
    action: (input, key) => {
      if (key.escape) {
        leave()
      }
    }
  })

  if (confirmed !== null) {
    return (
      <TaskBox prompt={prompt} id={`${id}-result`} active={false}>
        <Text dimColor>{confirmed ? 'Yes' : 'No'}</Text>
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
          setConfirmed(value)
          dispatch({ type: 'increment-current-task' })
          setValue({ state, dispatch, value })
        }}
      />
    </TaskContainer>
  )
}
