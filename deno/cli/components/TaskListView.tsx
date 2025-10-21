import React from 'react'
import { useTask } from './TaskContext.tsx'
import { Box } from 'ink'
import { useSkmtc } from './SkmtcContext.tsx'

export const TaskListView = () => {
  const { state: taskState } = useTask()
  const { state: skmtcState } = useSkmtc()

  const paddingTop = skmtcState.interactive ? 0 : 1

  return (
    <Box flexDirection="column" paddingTop={paddingTop}>
      {taskState.tasks
        .filter(({ include }) => include)
        .filter((_task, index) => index <= taskState.currentTask)
        .map(task => {
          return <Box key={task.taskKey}>{task.render()}</Box>
        })}
    </Box>
  )
}
