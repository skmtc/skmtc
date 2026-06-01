import React, { useEffect, useState } from 'react'
import { useTask } from '@/components/TaskContext.tsx'
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
  const { dispatch: taskDispatch } = useTask()
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

    run()
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
