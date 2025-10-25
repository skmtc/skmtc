import { useTask } from '@/components/TaskContext.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Text } from 'ink'
import { SelectTask } from '@/components/SelectTask.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'

export const SelectProjectTask = () => {
  const { dispatch } = useTask()
  const { state } = useSkmtc()

  if (state.skmtcRoot.projects.length === 0) {
    return (
      <TaskBox id={`select-project-task`} active>
        <Text>No projects found</Text>
      </TaskBox>
    )
  }

  return (
    <SelectTask
      prompt="Select project"
      options={state.skmtcRoot.projects.map(project => ({
        label: project.name,
        value: project.name
      }))}
      setValue={value => {
        const project = state.skmtcRoot.findProject(value)

        dispatch({
          type: 'set-task-state',
          payload: { taskKey: 'select-project-task', state: project }
        })
      }}
    />
  )
}
