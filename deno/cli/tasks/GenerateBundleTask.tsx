import { useEffect, useState } from 'react'
import { tasksToState, useTask } from '@/components/TaskContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import type { Project } from '@/lib/project.ts'
import { createBundle } from '@/lib/create-bundle.ts'
import { TaskBox } from '../components/TaskBox.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { Text } from 'ink'

// `createBundle` / `toBundleFailureMessage` moved to
// `@/lib/create-bundle.ts` — they're ink-free orchestration, and keeping
// them out of this `.tsx` is what lets the headless `bundle`/`generate`/
// `dev` paths avoid importing the ink/react renderer graph. Import from
// there, not from this component file.

type GenerateBundleTaskProps = {
  project: Project
}

export const GenerateBundleTask = ({ project }: GenerateBundleTaskProps) => {
  const { dispatchMessage } = useSkmtc()
  const { state: taskState, dispatch: taskDispatch, leave } = useTask()
  const [done, setDone] = useState(false)

  useEffect(() => {
    const run = async () => {
      const bundlePath = await createBundle({ project })

      taskDispatch({
        type: 'set-task-state',
        payload: { taskKey: 'generate-bundle-task', state: bundlePath }
      })
      setDone(true)
      taskDispatch({ type: 'increment-current-task' })
    }

    // A refused or failed build ends the run with its message and exit 1,
    // as the headless path does.
    run().catch(error => {
      Deno.exitCode = 1
      dispatchMessage({ error: error instanceof Error ? error.message : String(error) })
      leave({ state: tasksToState(taskState.tasks) })
    })
  }, [])

  if (done) {
    return (
      <TaskBox active={false}>
        <Text>Bundle created</Text>
      </TaskBox>
    )
  }

  return (
    <TaskBox active>
      <Spinner label="Creating bundle..." />
    </TaskBox>
  )
}
