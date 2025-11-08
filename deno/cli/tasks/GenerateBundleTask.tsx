import React, { useState, useEffect } from 'react'
import { useTask } from '@/components/TaskContext.tsx'
import { BooleanTask } from './BooleanTask.tsx'
import { tasksToState } from '@/components/TaskContext.tsx'
import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'

type GenerateBundleTaskProps = {
  project: Project
}

export const GenerateBundleTask = ({ project }: GenerateBundleTaskProps) => {
  const [confirmed, setConfirmed] = useState(false)
  const { state: taskState, dispatch: taskDispatch, leave } = useTask()

  useEffect(() => {
    if (!confirmed) {
      return
    }

    const run = async () => {
      const bundlePath = await createBundle({ project })

      taskDispatch({
        type: 'set-task-state',
        payload: { taskKey: 'generate-bundle-task', state: bundlePath }
      })
      taskDispatch({ type: 'increment-current-task' })
    }

    run()
  }, [confirmed])

  return (
    <BooleanTask
      prompt="Worker bundle not found. Create it?"
      setValue={({ value }) => {
        value ? setConfirmed(value) : leave({ state: tasksToState(taskState.tasks) })
      }}
    />
  )
}

type CreateBundleArgs = {
  project: Project
}

export const createBundle = async ({ project }: CreateBundleArgs): Promise<string> => {
  const fileName = 'bundle.js'
  const projectPath = project.toPath()
  const bundlePath = `file://${join(project.toPath(), fileName)}`

  await project.createWorker()

  const command = new Deno.Command('deno', {
    args: ['bundle', '-o', fileName, 'worker.ts'],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped'
  })

  const logsPath = join(projectPath, '.settings', 'logs.txt')
  const errorLogsPath = join(projectPath, '.settings', 'error-logs.txt')

  const { success, stdout, stderr } = await command.output()

  let logsFile: Deno.FsFile | undefined
  try {
    // Read stdout and write to file
    const logsFile = await Deno.open(logsPath, { create: true, append: true })
    await logsFile.write(stdout)
  } catch (error) {
    throw error
  } finally {
    logsFile?.close()
  }

  let errorLogsFile: Deno.FsFile | undefined
  try {
    const errorLogsFile = await Deno.open(errorLogsPath, { create: true, append: true })
    await errorLogsFile.write(stderr)
  } catch (error) {
    throw error
  } finally {
    errorLogsFile?.close()
  }

  if (!success) {
    throw new Error('Failed to create bundle')
  }

  return bundlePath
}
