import { useState, useEffect } from 'react'
import { useTask } from '@/components/TaskContext.tsx'
import { BooleanTask } from './BooleanTask.tsx'
import { tasksToState } from '@/components/TaskContext.tsx'
import type { Project } from '@/lib/project.ts'

type GenerateWorkerTaskProps = {
  project: Project
}

export const GenerateWorkerTask = ({ project }: GenerateWorkerTaskProps) => {
  const [confirmed, setConfirmed] = useState(false)
  const { state: taskState, dispatch: taskDispatch, leave } = useTask()

  useEffect(() => {
    if (!confirmed) {
      return
    }

    const run = async () => {
      const workerPath = await project.createWorker()

      taskDispatch({
        type: 'set-task-state',
        payload: { taskKey: 'generate-worker-task', state: workerPath }
      })
      taskDispatch({ type: 'increment-current-task' })
    }

    run()
  }, [confirmed])

  return (
    <BooleanTask
      prompt="Worker not found. Create it?"
      setValue={({ value }) => {
        value ? setConfirmed(value) : leave({ state: tasksToState(taskState.tasks) })
      }}
    />
  )
}
