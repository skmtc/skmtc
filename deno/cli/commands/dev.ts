import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { Project } from '@/lib/project.ts'
import { createBundle } from '@/lib/create-bundle.ts'
import { generateLocal } from '@/lib/generate-local.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toAttributedSource } from '@/lib/schema-file.ts'
import { toBundlePath } from '@/lib/to-bundle-path.ts'
import { toManifestPath } from '@/lib/to-manifest-path.ts'
import chokidar, { type FSWatcher } from 'chokidar'
import invariant from 'tiny-invariant'

type DevArgs = {
  projectName: string
  schemaSourceString: string | undefined
}

const REBUILD_DEBOUNCE_MS = 250
const COALESCE_TAIL_MS = 50

const stamp = (): string => new Date().toISOString().slice(11, 19)

const log = (msg: string) => {
  console.log(`[${stamp()}] ${msg}`)
}

const shouldIgnore = (path: string): boolean => {
  return (
    path.includes('/.settings/') ||
    path.endsWith('/bundle.js') ||
    path.endsWith('/worker.ts') ||
    path.includes('/node_modules/') ||
    path.includes('/.git/')
  )
}

export const dev = async ({ projectName, schemaSourceString }: DevArgs) => {
  const skmtcRoot = await SkmtcRoot.open(new Manager())
  const project = skmtcRoot.findProject(projectName)
  invariant(project instanceof Project, `Project "${projectName}" must be a local project`)

  const projectPath = project.toPath()
  const bundlePath = toBundlePath(projectPath)
  const manifestPath = toManifestPath(projectPath)

  const schemaSource = schemaSourceString ?? project.clientJson.contents?.source
  invariant(
    typeof schemaSource === 'string' && schemaSource.length > 0,
    'No schema source — pass <schema> as an argument or set "source" in client.json'
  )

  let running = false
  let queued = false

  const runOnce = async (): Promise<void> => {
    if (running) {
      queued = true
      return
    }
    running = true
    try {
      const bundleStart = performance.now()
      log('bundling…')
      await createBundle({ project })
      const bundleMs = Math.round(performance.now() - bundleStart)
      log(`bundled in ${bundleMs}ms · generating…`)

      const generateStart = performance.now()
      const schemaContents = await toSchemaContents(schemaSource)
      const { stats } = await generateLocal({
        bundlePath,
        manifestPath,
        projectPath,
        schemaContents: schemaContents.contents,
        fileType: schemaContents.fileType,
        clientSettings: project.clientJson.contents?.settings,
        // The RESOLVED source, matching `toGenerateLocalArgs`. Passing the
        // raw pin here instead would make `dev` and `generate` write
        // different `schemaSrc` values, so alternating between them
        // rewrites the `src` field of every committed gen-map.
        schemaSource: toAttributedSource(schemaSource, schemaContents.schemaSource)
      })
      const generateMs = Math.round(performance.now() - generateStart)
      const errorSuffix = stats.errors.length ? ` · ${stats.errors.length} errors` : ''
      log(`generated ${stats.files} files in ${generateMs}ms${errorSuffix}`)
    } catch (error) {
      log(`error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      running = false
      if (queued) {
        queued = false
        setTimeout(() => {
          void runOnce()
        }, COALESCE_TAIL_MS)
      }
    }
  }

  await runOnce()

  log(`watching ${projectPath}`)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const watcher: FSWatcher = chokidar.watch(projectPath, {
    ignored: (path: string) => shouldIgnore(path),
    ignoreInitial: true,
    persistent: true
  })

  const onChange = (path: string) => {
    log(`changed: ${path}`)
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      void runOnce()
    }, REBUILD_DEBOUNCE_MS)
  }

  watcher.on('add', onChange)
  watcher.on('change', onChange)
  watcher.on('unlink', onChange)

  const shutdown = async () => {
    log('shutting down…')
    await watcher.close()
    Deno.exit(0)
  }

  Deno.addSignalListener('SIGINT', () => {
    void shutdown()
  })

  await new Promise<void>(() => {})
}
