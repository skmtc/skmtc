import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useTask } from '@/components/TaskContext.tsx'
import { StringTask } from '@/components/StringTask.tsx'

export const ProjectNameTask = () => {
  const { state } = useSkmtc()
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt="Project name"
      setValue={value => {
        const { skmtcRoot } = state

        if (value.length < 3) {
          console.error('Project name must be at least 3 characters long')
          return
        }

        // Check if project already exists
        const existingProject = skmtcRoot.projects.find(p => p.name === value)
        if (existingProject) {
          console.error(`Project "${value}" already exists`)
          return
        }

        dispatch({ type: 'set-task-state', payload: { taskKey: 'project-name', state: value } })
      }}
    />
  )
}
