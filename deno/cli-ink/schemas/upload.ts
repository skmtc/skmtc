import { Command } from '@cliffy/command'
import { Input } from '../components/index.ts'
import { OpenApiSchema } from '../lib/openapi-schema.ts'
import * as Sentry from '@sentry/node'
import chokidar from 'chokidar'
import { WsClient } from '../lib/ws-client.ts'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { Project } from '../lib/project.ts'
import invariant from 'tiny-invariant'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'

export const description = 'Upload an OpenAPI schema to Skmtc'

export const toUploadCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description(description)
    .arguments('<project:string> <path:string>')
    .option('-w, --watch', 'Watch for changes and upload automatically')
    .action(async ({ watch }, projectName, path) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project, 'Project not found')

      if (watch) {
        watchUpload({ project, skmtcRoot, path })
      } else {
        await upload({ project, skmtcRoot, path })
      }
    })
}

export const toUploadPrompt = async (skmtcRoot: SkmtcRoot, projectName: string) => {
  const project = skmtcRoot.projects.find(({ name }) => name === projectName)

  invariant(project, 'Project not found')

  console.log('TODO: Add ink Confirm prompt')

  // const path = await Input.prompt({
  //   message: 'Enter path to OpenAPI schema',
  //   files: true
  // })

  // const watch = await Confirm.prompt({
  //   message: 'Watch for changes and upload automatically?'
  // })

  // if (watch) {
  //   watchUpload({ project, skmtcRoot, path })
  // } else {
  //   await upload({ project, skmtcRoot, path })
  // }
}

type UploadArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
  path: string
}

type UploadOptions = {
  logSuccess?: string
}

export const watchUpload = ({ project, skmtcRoot, path }: UploadArgs) => {
  const watcher = chokidar.watch(path)

  watcher.on('change', () =>
    upload({ project, skmtcRoot, path }, { logSuccess: 'Schema uploaded' })
  )
}

export const upload = async (
  { project, skmtcRoot, path }: UploadArgs,
  { logSuccess }: UploadOptions = {}
) => {
  try {
    const workspace = await getApiWorkspacesWorkspaceName({
      workspaceName: project.name,
      supabase: skmtcRoot.manager.auth.supabase
    })

    let wsClient: WsClient | null = null

    if (workspace) {
      wsClient = new WsClient({ workspaceId: workspace.id })

      wsClient.connect()
    }

    const openApiSchema = await OpenApiSchema.open(path)

    const schema = await openApiSchema.upload({ projectName: project.name, skmtcRoot })

    console.log('UPLOAD IS NOT IMPLEMENTED')

    // if (workspace && wsClient) {
    //   await wsClient.send({
    //     type: 'update-schema',
    //     payload: {
    //       v3JsonFilePath: schema.v3JsonFilePath
    //     }
    //   })

    //   wsClient.disconnect()
    // }

    await skmtcRoot.manager.success()
  } catch (error) {
    console.error(error)

    Sentry.captureException(error)

    await Sentry.flush()

    await skmtcRoot.manager.fail('Failed to upload schema')
  }
}
