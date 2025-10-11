import React from 'react'
import { Box, Text } from 'ink'
import type { Project } from '@/lib/project.ts'
import type { ViewStateServe } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import * as Sentry from '@sentry/node'
import { toMod } from '@/lib/to-mod.ts'
import { join } from '@std/path/join'
import { TaskBox } from './TaskBox.tsx'
import { Spinner } from '@inkjs/ui'
import { dirname } from '@std/path/dirname'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

type ServeViewProps = {
  project: Project
  view: ViewStateServe
}

export const ServeView = ({ project, view }: ServeViewProps) => {
  const { state, dispatch } = useSkmtc()
  const port = view.port || '8001'

  useEffect(() => {
    const serve = async () => {
      try {
        await project.clientJson?.refresh()

        await project.prettierJson?.refresh()

        const modPath = await project.createServer()

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

        await runServer({ modPath, port })

        delete project.clientJson.contents?.serverUrl

        await project.clientJson.write()
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Failed to serve')

        Sentry.captureException(error)

        await Sentry.flush()
      } finally {
        await state.skmtcRoot.manager.cleanup()
      }
    }

    serve()
  }, [])

  return (
    <TaskBox id={`serve-project-task`} active>
      <Box flexDirection="column">
        <Spinner label="Serving..." />
        <Text dimColor>Serving on port {port}</Text>
      </Box>
    </TaskBox>
  )
}

type RunServerArgs = {
  modPath: string
  port: string
}

export const runServer = async ({ modPath, port = '8001' }: RunServerArgs) => {
  const command = new Deno.Command('deno', {
    args: ['serve', '--allow-env', '--allow-sys', '--port', port, modPath],
    cwd: dirname(modPath)
  })

  // create subprocess and collect output
  const { code, stdout, stderr } = await command.output()

  console.log(new TextDecoder().decode(stdout))
  console.log(new TextDecoder().decode(stderr))

  return new Promise((resolve, reject) => {
    if (code === 0) {
      resolve(code)
    } else {
      reject(new Error(`Server exited with code ${code}`))
    }
  })
}

type ServeArgs = {
  skmtcRoot: SkmtcRoot
  project: Project
  port: string
}

export const serve = async ({ skmtcRoot, project, port }: ServeArgs) => {
  try {
    await project.clientJson?.refresh()

    // if (project) {
    //   await project.schemaFile.promptOrFail(project)
    // }

    await project.prettierJson?.refresh()

    const mod = toMod(project.toGeneratorIds())

    const modPath = join(project.toPath(), 'mod.ts')

    await Deno.writeTextFile(modPath, mod)

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

    await runServer({ modPath, port })

    delete project.clientJson.contents?.serverUrl

    await project.clientJson.write()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to serve')

    Sentry.captureException(error)

    await Sentry.flush()
  } finally {
    await skmtcRoot.manager.cleanup()
  }
}
