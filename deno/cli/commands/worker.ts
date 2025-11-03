import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Command } from '@cliffy/command'
import { join } from '@std/path'
import { toGenerationStats } from '@/lib/generationStats.ts'

export const description =
  'Web worker proof of concept - test generator execution in isolated worker'

type RenderWorkerArgs = {
  project: string
}

export const renderWorker = async ({ project }: RenderWorkerArgs) => {
  console.time('WORKER_COMMAND')

  // Resolve paths
  const projectPath = join(SkmtcRoot.toPath(), project)
  const workerPath = join(projectPath, 'bundle.js')
  const schemaPath = join(projectPath, 'openapi.json')
  const clientSettingsPath = join(projectPath, '.settings', 'client.json')

  // Check if files exist
  try {
    await Deno.stat(workerPath)
    await Deno.stat(schemaPath)
  } catch (_error) {
    console.error(`Error: Required files not found in ${projectPath}`)
    console.error('Make sure mod.ts and openapi.json exist')
    return
  }

  console.log('🧪 Web Worker Proof of Concept')
  console.log('Creating worker...')

  console.log('WORKER PATH:', workerPath)

  console.time('WORKER_LAUNCH')

  // Create worker
  const workerUrl = new URL(workerPath, import.meta.url)

  console.log('WORKER URL:', workerUrl.href)
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

  console.timeEnd('WORKER_LAUNCH')

  console.time('WORKER_READY')

  // Set up message handler
  worker.onmessage = async (e: MessageEvent) => {
    const { type } = e.data

    switch (type) {
      case 'READY': {
        console.timeEnd('WORKER_READY')

        console.log(`✓ Worker ready (generator: ${e.data.generatorId})`)

        // Load and send schema
        const schemaContent = await Deno.readTextFile(schemaPath)

        const clientSettings = await Deno.readTextFile(clientSettingsPath)

        console.log('Sending TRANSFORM message...')
        console.time('TRANSFORM')
        worker.postMessage({
          type: 'TRANSFORM',
          payload: {
            documentObject: JSON.parse(schemaContent),
            clientSettings: JSON.parse(clientSettings)
          }
        })
        break
      }

      case 'RESULT': {
        console.log(`✓ Transform complete`)
        console.log(`  Generated ${Object.keys(e.data.artifacts).length} artifacts`)

        console.timeEnd('TRANSFORM')

        const stats = toGenerationStats(e.data)

        console.log('STATS:', stats)

        console.timeEnd('WORKER_COMMAND')
        // Cleanup
        worker.terminate()
        Deno.exit(0)
        break
      }

      case 'ERROR': {
        console.error('❌ Worker error:', e.data.error)
        console.timeEnd('WORKER_COMMAND')
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

export const toWorkerCommand = (_skmtcRoot: SkmtcRoot) => {
  const command = new Command()
    .description(description)
    .option('-p, --project <path:string>', 'Project path (defaults to skmtc-zod)', {
      default: 'skmtc-zod'
    })
    .action(async options => {
      await renderWorker({ project: options.project })
    })

  return command
}
