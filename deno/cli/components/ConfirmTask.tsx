import React, { useId } from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useTask } from '@/components/TaskContext.tsx'
import { useShortcut } from './useShortcut.tsx'
import { useState } from 'react'
import { TaskAction, TaskState } from '@/components/TaskContext.tsx'
import { Dispatch } from 'react'

type ConfirmTaskArgs = {
  state: TaskState
  dispatch: Dispatch<TaskAction>
}

type ConfirmTaskProps = {
  prompt: string
  projectName: string
  onConfirm: ({ state, dispatch }: ConfirmTaskArgs) => Promise<void> | void
}

export const ConfirmTask = ({ prompt, projectName, onConfirm }: ConfirmTaskProps) => {
  const { state, dispatch, leave } = useTask()
  const [confirmed, setConfirmed] = useState(false)
  const id = useId()

  useShortcut({
    label: `'esc' to ${projectName}`,
    action: (input, key) => {
      if (key.escape) {
        leave()
      }
    }
  })

  if (confirmed) {
    return (
      <Box flexDirection="column" marginBottom={1} key={`${id}-confirmed`}>
        <Text>{prompt}</Text>
        <Text dimColor>{confirmed ? 'Yes' : 'No'}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" key={`${id}-input`}>
      <Text>{prompt}</Text>
      <SelectInput
        items={[
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]}
        onSelect={({ value }) => {
          if (value) {
            setConfirmed(value)
            dispatch({ type: 'set-current-task', payload: state.currentTask + 1 })
            onConfirm({ state, dispatch })
          } else {
            leave()
          }
        }}
      />
    </Box>
  )
}
