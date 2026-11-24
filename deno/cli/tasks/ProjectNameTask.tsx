import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useTask } from '@/components/TaskContext.tsx'
import { StringTask } from '@/components/StringTask.tsx'
import { validateProjectName } from '@/lib/validate-project-name.ts'

export const ProjectNameTask = () => {
  const { state } = useSkmtc()
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt="Project name"
      setValue={value => {
        const { skmtcRoot } = state

        // A folder that did not load still takes its name.
        const result = validateProjectName(value, skmtcRoot.toProjectNames())

        if (!result.valid) {
          console.error(result.error)
          return
        }

        dispatch({
          type: 'set-task-state',
          payload: { taskKey: 'project-name', state: result.value }
        })
      }}
    />
  )
}
