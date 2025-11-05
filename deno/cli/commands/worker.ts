import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Command } from '@cliffy/command'
import { join } from '@std/path'
import { Manager } from '@/lib/manager.ts'
import { toV3Document, stringToSchema } from '@skmtc/convert'
import invariant from 'tiny-invariant'

export const description =
  'Web worker proof of concept - test generator execution in isolated worker'

type RenderWorkerArgs = {
  projectName: string
  skmtcRoot?: SkmtcRoot
}

export const renderWorker = async ({
  projectName,
  skmtcRoot: providedSkmtcRoot
}: RenderWorkerArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.findProject(projectName)

  const workerPath = join(project.toPath(), 'mod.ts')

  const workerUrl = new URL(workerPath, import.meta.url)

  const schemaContents = project.schemaFile.contents

  invariant(schemaContents, 'Schema contents not found')

  const documentObject = await toV3Document(stringToSchema(schemaContents))

  const clientSettings = project.clientJson.contents

  invariant(clientSettings, 'Client settings not found')

  const worker = new Worker(workerUrl.href, {
    type: 'module',
    deno: {
      permissions: {
        read: true,
        net: false,
        write: true,
        env: true,
        run: false
      }
    }
  })

  // Set up message handler
  worker.onmessage = (e: MessageEvent) => {
    const { type } = e.data

    switch (type) {
      case 'READY': {
        worker.postMessage({
          type: 'TRANSFORM',
          payload: { documentObject, clientSettings }
        })
        break
      }

      case 'RESULT': {
        // Write artifacts to disk
        // Cleanup
        worker.terminate()
        Deno.exit(0)
        break
      }

      case 'ERROR': {
        worker.terminate()
        Deno.exit(1)
        break
      }

      default:
        console.log(`Received: ${type}`)
    }
  }

  worker.onerror = error => {
    console.error('❌ Worker error:', error)
    console.timeEnd('WORKER_COMMAND')
    Deno.exit(1)
  }
}
