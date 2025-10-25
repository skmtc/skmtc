import React, { useId } from 'react'
import SelectInput from 'ink-select-input'
import { useState } from 'react'
import { TaskContainer } from '@/components/TaskContainer.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Text } from 'ink'

type BooleanTaskArgs = {
  value: boolean
}

type BooleanTaskProps = {
  prompt: string
  setValue: ({ value }: BooleanTaskArgs) => Promise<void> | void
}

export const BooleanTask = ({ prompt, setValue }: BooleanTaskProps) => {
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const id = useId()

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

          setValue({ value })
        }}
      />
    </TaskContainer>
  )
}
