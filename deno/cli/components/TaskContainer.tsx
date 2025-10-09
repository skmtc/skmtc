import React, { useId } from 'react'
import { useShortcut } from './useShortcut.tsx'
import { useTask } from './TaskContext.tsx'
import { useProjectName } from './SkmtcContext.tsx'
import { TaskBox } from './TaskBox.tsx'

type TaskContainerProps = {
  prompt: string
  children: React.ReactNode
}

export const TaskContainer = ({ prompt, children }: TaskContainerProps) => {
  const id = useId()
  const { leave } = useTask()
  const projectName = useProjectName()

  useShortcut({
    key: 'esc',
    name: projectName ?? 'home',
    action: (input, key) => {
      if (key.escape) {
        leave()
      }
    }
  })

  return (
    <TaskBox id={`${id}-container`} prompt={prompt} active>
      {children}
    </TaskBox>
  )
}
