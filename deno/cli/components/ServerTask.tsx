import React, { useId, useEffect } from 'react'
import { useState } from 'react'
import type { Project } from '@/lib/project.ts'
import { useTask } from './TaskContext.tsx'
import { Box } from 'ink'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import type { Dispatch, SetStateAction } from 'react'

const isPortAvailable = async (port: number): Promise<boolean> => {
  try {
    const conn = await Deno.connect({ port, hostname: 'localhost' })
    conn.close()
    return false // Port is in use
  } catch {
    return true // Port is available
  }
}

const findAvailablePort = async (startPort: number): Promise<number> => {
  let port = startPort
  while (!(await isPortAvailable(port))) {
    port++
  }
  return port
}

const waitForServerReady = async (port: number): Promise<void> => {
  const maxRetries = 60 // 60 attempts
  const initialBackoff = 100 // Start with 100ms
  const maxBackoff = 2000 // Cap at 2 seconds
  const timeout = 30000 // 30 second total timeout

  const startTime = Date.now()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check if we've exceeded total timeout
    if (Date.now() - startTime > timeout) {
      throw new Error('Server startup timeout: /generators endpoint did not respond')
    }

    try {
      const response = await fetch(`http://localhost:${port}/generators`)
      if (response.ok) {
        return // Server is ready!
      }
    } catch {
      // Server not ready yet, continue retrying
    }

    // Exponential backoff with cap
    const backoffMs = Math.min(initialBackoff * Math.pow(2, attempt), maxBackoff)
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

  throw new Error('Server startup timeout: maximum retries exceeded')
}

type ServerTaskProps = {
  project: Project
}

export const ServerTask = ({ project }: ServerTaskProps) => {
  const { dispatch } = useTask()

  useEffect(() => {
    const serve = async () => {
      const modPath = await project.createServer()

      const port = String(await findAvailablePort(8001))

      const serverUrl = `http://localhost:${port}`

      project.clientJson.contents = project.clientJson.contents
        ? {
            ...project.clientJson.contents,
            serverUrl
          }
        : {
            serverUrl,
            settings: {}
          }

      await project.clientJson.write()

      const child = await runServer({ modPath, port })

      dispatch({ type: 'set-task-state', payload: { taskKey: 'start-server-task', state: child } })
      dispatch({ type: 'increment-current-task' })
    }

    serve()
  }, [])

  return <Box></Box>
}

type RunServerArgs = {
  modPath: string
  port: string
}

export const runServer = async ({
  modPath,
  port = '8001'
}: RunServerArgs): Promise<Deno.ChildProcess> => {
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

  // Wait for server to be ready by polling /generators endpoint
  await waitForServerReady(Number(port))

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
