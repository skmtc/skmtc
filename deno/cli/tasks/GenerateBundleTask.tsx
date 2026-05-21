import React, { useEffect, useState } from 'react'
import { useTask } from '@/components/TaskContext.tsx'
import { join } from '@std/path/join'
import type { Project } from '@/lib/project.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'
import { TaskBox } from '../components/TaskBox.tsx'
import { Spinner } from '../components/Spinner.tsx'
import { Text } from 'ink'

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

type CreateBundleArgs = {
  project: Project
}

export const createBundle = async ({ project }: CreateBundleArgs): Promise<string> => {
  const fileName = 'bundle.js'
  const projectPath = project.toPath()
  const bundlePath = toBundlePath(project.toPath())

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
    // Read stdout and write to file. Assign the outer binding (no
    // `const`) so `finally` actually closes the handle.
    logsFile = await Deno.open(logsPath, { create: true, append: true })
    await logsFile.write(stdout)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    logsFile?.close()
  }

  let errorLogsFile: Deno.FsFile | undefined
  try {
    errorLogsFile = await Deno.open(errorLogsPath, { create: true, append: true })
    await errorLogsFile.write(stderr)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    errorLogsFile?.close()
  }

  if (!success) {
    throw new Error(toBundleFailureMessage({ projectPath, errorLogsPath, stderr }))
  }

  return bundlePath
}

type ToBundleFailureMessageArgs = {
  projectPath: string
  errorLogsPath: string
  stderr: Uint8Array
}

/**
 * Build the error message for a failed `deno bundle`.
 *
 * The captured subprocess stderr is the only diagnosable cause of a
 * bundle failure — wrong Deno version, missing import-map entry, bad
 * specifier. Without it every distinct failure collapses to an opaque
 * "Failed to create bundle" and the real error is reachable only by
 * knowing to read `.settings/error-logs.txt` out of band.
 */
export const toBundleFailureMessage = ({
  projectPath,
  errorLogsPath,
  stderr
}: ToBundleFailureMessageArgs): string => {
  const errorOutput = new TextDecoder().decode(stderr).trim()

  return [
    `Failed to create bundle — \`deno bundle\` failed in ${projectPath}.`,
    errorOutput || '(no stderr captured)',
    `Full output: ${errorLogsPath}`
  ].join('\n\n')
}
