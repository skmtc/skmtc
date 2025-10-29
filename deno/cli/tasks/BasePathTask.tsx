import { useTask } from '@/components/TaskContext.tsx'
import { StringTask } from '@/components/StringTask.tsx'

export const BasePathTask = () => {
  const { dispatch } = useTask()

  console.log('BASE PATH TASK')

  return (
    <StringTask
      prompt="Output directory for generated files"
      defaultValue="src"
      setValue={value => {
        dispatch({ type: 'set-task-state', payload: { taskKey: 'base-path', state: value } })
      }}
    />
  )
}
