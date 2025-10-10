import React, { useId, useEffect } from 'react'
import { useState } from 'react'
import type { Project } from '@/lib/project.ts'
import { useTask } from './TaskContext.tsx'
import { Box } from 'ink'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import type { Dispatch, SetStateAction } from 'react'

type ServerTaskProps = {
  project: Project
  setChild: Dispatch<SetStateAction<Deno.ChildProcess | undefined>>
}

export const ServerTask = ({ project, setChild }: ServerTaskProps) => {
  const { dispatch } = useTask()

  useEffect(() => {
    const serve = async () => {
      const modPath = await project.createServer()

      const child = runServer({ modPath, port: '8001' })

      setChild(child)
      dispatch({ type: 'increment-current-task' })
    }

    serve()
  }, [])

  return <Box></Box>

  // if (serving) {
  //   return (
  //     <TaskBox id={`${id}-result`} active={false}>
  //       <Spinner label="Serving..." />
  //     </TaskBox>
  //   )
  // }

  // return (
  //   <TaskContainer>
  //     <Spinner label="Starting server..." />
  //   </TaskContainer>
  // )
}

type RunServerArgs = {
  modPath: string
  port: string
}

export const runServer = ({ modPath, port = '8001' }: RunServerArgs) => {
  const command = new Deno.Command('deno', {
    args: ['serve', '--allow-env', '--allow-sys', '--port', port, modPath],
    cwd: dirname(modPath),
    stdout: 'piped',
    stderr: 'piped'
  })

  const logsPath = join(dirname(modPath), '.settings', 'logs.txt')
  const errorLogsPath = join(dirname(modPath), '.settings', 'error-logs.txt')

  // create subprocess and collect output
  const child = command.spawn()

  // Read stdout in the background and write to file
  ;(async () => {
    const reader = child.stdout.getReader()
    const decoder = new TextDecoder()
    const file = await Deno.open(logsPath, { create: true, append: true })
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        await file.write(new TextEncoder().encode(text))
      }
    } finally {
      reader.releaseLock()
      file.close()
    }
  })()

  // Read stderr in the background and write to file
  ;(async () => {
    const reader = child.stderr.getReader()
    const decoder = new TextDecoder()
    const file = await Deno.open(errorLogsPath, { create: true, append: true })
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        await file.write(new TextEncoder().encode(text))
      }
    } finally {
      reader.releaseLock()
      file.close()
    }
  })()

  return child
}
