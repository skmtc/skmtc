import { useTask } from '@/components/TaskContext.tsx'
import { useGetGenerators } from '@/components/useGetGenerators.ts'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Spinner } from '@inkjs/ui'
import { Text } from 'ink'
import { MultiselectTask } from '@/components/MultiselectTask.tsx'

export const GeneratorsTask = () => {
  const { dispatch } = useTask()
  const generators = useGetGenerators()

  if (!generators) {
    return (
      <TaskBox id={`generators-task`} active>
        <Spinner label="Loading generators..." />
      </TaskBox>
    )
  }

  if (generators.length === 0) {
    return (
      <TaskBox id={`generators-task`} active>
        <Text>No generators found</Text>
      </TaskBox>
    )
  }

  return (
    <MultiselectTask
      prompt="Select generators to install"
      options={generators.map(gen => ({
        label: `@${gen.scope}/${gen.packageName}`,
        value: `@${gen.scope}/${gen.packageName}`
      }))}
      setValues={values => {
        dispatch({ type: 'set-task-state', payload: { taskKey: 'generators', state: values } })
      }}
    />
  )
}
