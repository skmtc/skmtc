import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { tasksToState, useTask } from '@/components/TaskContext.tsx'
import { Spinner } from '@/components/Spinner.tsx'
import invariant from 'tiny-invariant'
import { useEffect } from 'react'

export const InstallGeneratorsTask = () => {
  const { state, dispatchMessage } = useSkmtc()

  const { state: taskState, dispatch: taskDispatch, leave } = useTask()

  const { 'select-project-task': project, generators } = tasksToState(taskState.tasks)

  invariant(project, 'Project is required')
  invariant(generators, 'Generators are required')

  useEffect(() => {
    const run = async () => {
      await Promise.all(
        generators.map(async generator => {
          await project.installGenerator({ moduleName: `jsr:${generator}` })
        })
      )
        .then(() => {
          dispatchMessage({
            success: `Installed ${generators.join(', ')} in "${project.name}"`
          })

          taskDispatch({
            type: 'set-task-state',
            payload: { taskKey: 'install-generators-task', state: true }
          })

          leave({ state: tasksToState(taskState.tasks) })
        })
        .catch(error => {
          console.error(error)
          dispatchMessage({ error: `Failed to install generator(s)` })

          taskDispatch({
            type: 'set-task-state',
            payload: { taskKey: 'install-generators-task', state: false }
          })

          leave({ state: tasksToState(taskState.tasks) })
        })
    }

    run()
  }, [state.view])

  return <Spinner label="Installing generators..." />
}
