import { Text } from 'ink'
import SelectInput from 'ink-select-input'
import { useState } from 'react'
import type { Option } from '@/components/types.ts'
import { TaskBox } from './TaskBox.tsx'
import { TaskContainer } from './TaskContainer.tsx'
import { useTask } from './TaskContext.tsx'

type SelectTaskProps = {
  prompt: string
  options: Option[]
  setValue: (value: string) => void
}

export const SelectTask = ({ prompt, options, setValue }: SelectTaskProps) => {
  const [response, setResponse] = useState<string | null>(null)
  const { dispatch } = useTask()

  if (response !== null) {
    return (
      <TaskBox prompt={prompt} active={false}>
        <Text dimColor>{response}</Text>
      </TaskBox>
    )
  }

  return (
    <TaskContainer prompt={prompt}>
      <SelectInput
        items={options}
        onSelect={item => {
          setResponse(item.value)
          dispatch({ type: 'increment-current-task' })
          setValue(item.value)
        }}
      />
    </TaskContainer>
  )
}
