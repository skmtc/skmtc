import React from 'react'
import { useTask } from './TaskContext.tsx'
import { Box } from 'ink'

export const TaskListView = () => {
  const { state } = useTask()

  return (
    <Box flexDirection="column">
      {state.tasks
        .filter(({ include }) => include)
        .filter((_task, index) => index <= state.currentTask)
        .map(task => {
          return <Box key={task.key}>{task.render()}</Box>
        })}
    </Box>
  )
}
