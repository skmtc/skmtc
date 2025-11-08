import { useTask } from '@/components/TaskContext.tsx'
import { BooleanTask } from './BooleanTask.tsx'
import { tasksToState } from '@/components/TaskContext.tsx'

export const WatchModeTask = () => {
  const { state: taskState, dispatch: taskDispatch } = useTask()

  const { 'schema-location-task': schemaSourceString } = tasksToState(taskState.tasks)

  // useEffect(() => {
  //   if (isRemoteSchema(schemaSourceString)) {
  //     taskDispatch({
  //       type: 'set-task-state',
  //       payload: { taskKey: 'watch-mode-task', state: false }
  //     })

  //     taskDispatch({ type: 'increment-current-task' })
  //   }
  // }, [])

  return (
    <BooleanTask
      prompt="Watch for changes?"
      setValue={({ value }) => {
        taskDispatch({
          type: 'set-task-state',
          payload: { taskKey: 'watch-mode-task', state: value }
        })

        taskDispatch({ type: 'increment-current-task' })
      }}
    />
  )
}
