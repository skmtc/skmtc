import React from 'react'
import { useShortcut } from './useShortcut.tsx'
import { tasksToState, useTask } from './TaskContext.tsx'
import { useProjectName } from './SkmtcContext.tsx'
import { TaskBox } from './TaskBox.tsx'

type TaskContainerProps = {
  prompt: string
  children: React.ReactNode
}

export const TaskContainer = ({ prompt, children }: TaskContainerProps) => {
  const { state: taskState, leave } = useTask()
  const projectName = useProjectName()

  useShortcut({
    key: 'esc',
    name: projectName ?? 'home',
    action: (input, key) => {
      if (key.escape) {
        leave({ state: tasksToState(taskState.tasks) })
      }
    }
  })

  return (
    <TaskBox prompt={prompt} active>
      {children}
    </TaskBox>
  )
}
