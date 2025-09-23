import { Command } from '@cliffy/command'
import * as Sentry from '@sentry/node'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { Project } from '../lib/project.ts'
import { toMessage } from '../lib/to-message.tsx'
import { toSpinner } from '../lib/to-spinner.tsx'
import { toMod } from '../lib/to-mod.ts'
import { join } from '@std/path/join'
import invariant from 'tiny-invariant'

export const description = 'Run project server locally'

export const toServeCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> [port:string]')
    .action(async (_args, projectName, port) => {
      const project = await skmtcRoot.toProject({
        projectName,
        schemaPath: undefined
      })

      invariant(project instanceof Project, 'Project is not a local project')

      await serve({ project, skmtcRoot, port })
    })
}

type ServeArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  port: string | undefined
}

const serve = async ({ project, skmtcRoot, port = '8001' }: ServeArgs) => {
  try {
    await project.clientJson?.refresh()

    if (project) {
      await project.schemaFile.promptOrFail(project)
    }

    await project.prettierJson?.refresh()

    toSpinner({ message: 'Serving...' })

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

    await skmtcRoot.manager.success()
  } catch (error) {
    console.log('ERROR', error)

    toMessage({ messages: [] })

    console.error(error instanceof Error ? error.message : 'Failed to serve')

    Sentry.captureException(error)

    await Sentry.flush()

    await skmtcRoot.manager.fail()
  }
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
