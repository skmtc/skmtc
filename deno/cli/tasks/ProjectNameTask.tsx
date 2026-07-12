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

        const existingNames = skmtcRoot.projects.map(p => p.name)
        const result = validateProjectName(value, existingNames)

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
