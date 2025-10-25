import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { tasksToState, useTask } from '@/components/TaskContext.tsx'
import { useGetGenerators } from '@/components/useGetGenerators.ts'
import { useEffect } from 'react'
import { Project } from '@/lib/project.ts'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Spinner } from '@inkjs/ui'

export const CreateProjectTask = () => {
  const { state, dispatchMessage } = useSkmtc()
  const { state: taskState, dispatch: taskDispatch, leave } = useTask()
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

          taskDispatch({
            type: 'set-task-state',
            payload: { taskKey: 'create-project-task', state: project }
          })
          leave({ state: tasksToState(taskState.tasks) })
        })
        .catch(error => {
          console.error(error)

          dispatchMessage({ error: 'Failed to create project' })
          taskDispatch({
            type: 'set-task-state',
            payload: { taskKey: 'create-project-task', state: null }
          })
          leave({ state: tasksToState(taskState.tasks) })
        })
    }
  }, [state.view, availableGenerators])

  return (
    <TaskBox id={`create-project-container`} active>
      <Spinner label="Creating project..." />
    </TaskBox>
  )
}
