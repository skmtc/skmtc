import { useTask } from './TaskContext.tsx'
import { Box } from 'ink'

export const TaskListView = () => {
  const { state } = useTask()

  return (
    <Box flexDirection="column">
      {state.tasks
        .filter(({ include }, index) => include && index <= state.currentTask)
        .map(task => {
          return task.render()
        })}
    </Box>
  )
}
