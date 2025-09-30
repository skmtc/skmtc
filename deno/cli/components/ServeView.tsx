import React from 'react'
import { Box } from 'ink'
import type { Project } from '@/lib/project.ts'
import type { ViewStateServe } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import * as Sentry from '@sentry/node'
import { toMod } from '@/lib/to-mod.ts'
import { join } from '@std/path/join'

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
        dispatch({
          type: 'set-execution',
          payload: {
            type: 'serve',
            title: 'Serving...',
            subtitle: `Starting server on port ${port}`
          }
        })

        await project.clientJson?.refresh()

        if (project) {
          await project.schemaFile.promptOrFail(project)
        }

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

        await state.skmtcRoot.manager.success()
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Failed to serve')

        Sentry.captureException(error)

        await Sentry.flush()

        await state.skmtcRoot.manager.fail()
      }
    }

    serve()
  }, [])

  return <Box></Box>
}

type RunServerArgs = {
  modPath: string
  port: string
}

const runServer = async ({ modPath, port = '8001' }: RunServerArgs) => {
  const command = new Deno.Command('deno', {
    args: ['serve', '--allow-env', '--allow-sys', '--port', port, modPath]
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
