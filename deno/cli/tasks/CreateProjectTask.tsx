import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useTask } from '@/components/TaskContext.tsx'
import { useGetGenerators } from '@/components/useGetGenerators.ts'
import { useEffect } from 'react'
import { Project } from '@/lib/project.ts'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Spinner } from '@inkjs/ui'

export const CreateProjectTask = () => {
  const { state, dispatch, dispatchMessage } = useSkmtc()
  const { state: taskState, leave } = useTask()
  const availableGenerators = useGetGenerators()

  // Execute project creation when all inputs are collected
  useEffect(() => {
    const { skmtcRoot } = state

    const taskEntries = taskState.tasks.map(task => [task.taskKey, task.state])

    const taskMap = Object.fromEntries(taskEntries)

    const projectName = taskMap['project-name']
    const generators = taskMap['generators']
    const basePath = taskMap['base-path']

    if (projectName && generators?.length && basePath && availableGenerators?.length) {
      Project.create({
        skmtcRoot,
        name: projectName,
        basePath,
        generators,
        availableGenerators
      })
        .then(project => {
          dispatchMessage({ success: `Project "${project.name}" created` })

          leave()
        })
        .catch(error => {
          console.error(error)

          dispatchMessage({ error: 'Failed to create project' })
          dispatch({ type: 'set-view', payload: { page: 'home' } })
        })
    }
  }, [state.view, availableGenerators])

  return (
    <TaskBox id={`create-project-container`} active>
      <Spinner label="Creating project..." />
    </TaskBox>
  )
}
