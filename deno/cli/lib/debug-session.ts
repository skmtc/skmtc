import { join } from '@std/path/join'

type RunDebugSessionArgs = {
  /** Absolute path to the project dir (`.skmtc/<project>`). */
  projectPath: string
  /** `file://` URL of the project's `worker.ts` source. */
  workerHref: string
  /** The `GENERATE` message posted to the worker after the debugger attaches. */
  generateMessage: { type: 'GENERATE'; payload: unknown }
  /** Post `GENERATE` immediately without waiting for an attach (smoke test). */
  auto: boolean
  /** Inspector port for the worker host. */
  port: number
}

/**
 * The debug harness — the program the `deno run --config <project>/deno.json`
 * subprocess runs.
 *
 * It exists because the `skmtc` binary carries the CLI's own import map, but the
 * worker must resolve the PROJECT's map (core, the local `gen-*` clones). A
 * subprocess launched with `--config <project>/deno.json` gets that map, and any
 * `new Worker(...)` it spawns inherits it — so `worker.ts` **source** loads with
 * the project's dependencies and generator `.ts` files parse as their own modules
 * (source breakpoints bind 1:1, no bundle, no source maps).
 *
 * The harness has NO `@skmtc` imports — pure Deno APIs — so `--config` only shapes
 * the worker it spawns, never the harness itself. It relays worker messages to
 * stdout as JSON lines and forwards the `GENERATE` payload that arrives on stdin
 * (the go handshake) to the worker. The worker self-registers with the inspector
 * because the parent sets `SKMTC_DEBUG_INSPECTOR` (see `@skmtc/worker`'s `toWorker`).
 */
const DEBUG_HARNESS_SOURCE = `
const workerHref = Deno.env.get('SKMTC_DEBUG_WORKER')
if (!workerHref) {
  console.error('SKMTC_DEBUG_WORKER not set')
  Deno.exit(1)
}

const emit = (obj) => console.log(JSON.stringify(obj))

// net is scoped to localhost and sys to 'inspector' so \`inspector.open()\` can bind
// its debug server; generators still cannot reach the internet (no external hosts).
const worker = new Worker(workerHref, {
  type: 'module',
  deno: {
    permissions: {
      read: true,
      write: false,
      env: true,
      net: ['127.0.0.1'],
      sys: ['inspector'],
      run: false
    }
  }
})

worker.onmessage = (event) => {
  const data = event.data
  switch (data && data.type) {
    case 'INSPECTOR':
      emit({ type: 'INSPECTOR', url: data.url })
      break
    case 'READY':
      emit({ type: 'READY' })
      break
    case 'RESULT': {
      const artifacts = data.artifacts ?? {}
      const inspectionPath = Deno.env.get('SKMTC_DEBUG_INSPECTION')
      const hasInspection = Boolean(inspectionPath) && data.inspection !== undefined && data.inspection !== null
      if (hasInspection) {
        // Combined snapshot the extension reads: rendered text (artifacts) + the
        // serialized object graph (inspection), keyed by path.
        Deno.writeTextFileSync(
          inspectionPath,
          JSON.stringify({ artifacts: data.artifacts ?? {}, inspection: data.inspection })
        )
      }
      const inspectionFiles = hasInspection
        ? Object.keys(data.inspection).filter(key => key !== '__class').length
        : 0
      emit({ type: 'RESULT', fileCount: Object.keys(artifacts).length, inspectionFiles })
      worker.terminate()
      Deno.exit(0)
      break
    }
    case 'ERROR':
      emit({ type: 'ERROR', error: data.error ?? String(data) })
      worker.terminate()
      Deno.exit(1)
      break
  }
}

worker.onerror = (error) => {
  emit({ type: 'ERROR', error: String(error.message ?? error) })
  Deno.exit(1)
}

// The GENERATE payload arrives as one JSON line on stdin — receiving it IS the go
// handshake. Parse and forward to the worker, then let the worker keep the process
// alive until it posts RESULT (or ERROR).
const decoder = new TextDecoder()
let buffer = ''
for await (const chunk of Deno.stdin.readable) {
  buffer += decoder.decode(chunk)
  const newlineIndex = buffer.indexOf('\\n')
  if (newlineIndex !== -1) {
    worker.postMessage(JSON.parse(buffer.slice(0, newlineIndex)))
    break
  }
}
`

/**
 * Run a live debug session against a project's real worker.
 *
 * Spawns the harness subprocess, prints the worker's inspector URL, waits for the
 * debugger to attach + set breakpoints (Enter on stdin, or immediately with
 * `auto`), then triggers generation. Resolves with the subprocess exit code.
 */
export const runDebugSession = async ({
  projectPath,
  workerHref,
  generateMessage,
  auto,
  port
}: RunDebugSessionArgs): Promise<number> => {
  const harnessPath = await Deno.makeTempFile({ prefix: 'skmtc-debug-', suffix: '.ts' })
  await Deno.writeTextFile(harnessPath, DEBUG_HARNESS_SOURCE)

  // The harness writes the serialized inspectedFiles snapshot here (scoped write);
  // the extension / caller reads it back for the debugger views.
  const inspectionPath = await Deno.makeTempFile({ prefix: 'skmtc-inspection-', suffix: '.json' })

  const command = new Deno.Command('deno', {
    args: [
      'run',
      '--config',
      join(projectPath, 'deno.json'),
      `--inspect=127.0.0.1:${port}`,
      '--unstable-worker-options',
      '--allow-read',
      '--allow-env',
      '--allow-net',
      '--allow-sys',
      `--allow-write=${inspectionPath}`,
      harnessPath
    ],
    env: {
      ...Deno.env.toObject(),
      SKMTC_DEBUG_INSPECTOR: '1',
      SKMTC_DEBUG_WORKER: workerHref,
      SKMTC_DEBUG_INSPECTION: inspectionPath
    },
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'inherit'
  })

  const child = command.spawn()
  const writer = child.stdin.getWriter()
  const encoder = new TextEncoder()

  // Called exactly once — either the `auto` branch or the stdin handshake, never both.
  const sendGenerate = async () => {
    try {
      await writer.write(encoder.encode(`${JSON.stringify(generateMessage)}\n`))
      await writer.close()
    } catch {
      // The child may have already exited (error path) — nothing to send to.
    }
  }

  // A single line on the CLI's own stdin (the user pressing Enter, or a client
  // writing to `skmtc debug`'s stdin) is the "go" trigger once breakpoints are set.
  const waitForGo = async () => {
    try {
      for await (const _chunk of Deno.stdin.readable) {
        break
      }
    } catch {
      // stdin closed — fall through to generate.
    }
    await sendGenerate()
  }

  const handleMessage = async (
    message: {
      type: string
      url?: string
      fileCount?: number
      error?: string
      inspectionFiles?: number
    }
  ) => {
    switch (message.type) {
      case 'INSPECTOR': {
        console.log(`\nWorker inspector ready — attach a debugger to:\n  ${message.url}\n`)
        if (auto) {
          console.log('--auto: running generation now (no debugger attached).')
          await sendGenerate()
        } else {
          console.log(
            'Set breakpoints in your generator .ts files, then press Enter here to run generation…'
          )
          waitForGo()
        }
        break
      }
      case 'READY':
        break
      case 'RESULT':
        console.log(`\nGeneration complete — ${message.fileCount} file(s).`)
        if (message.inspectionFiles) {
          console.log(`Inspection snapshot: ${message.inspectionFiles} file(s) → ${inspectionPath}`)
        }
        break
      case 'ERROR':
        console.error(`\nWorker error: ${message.error}`)
        break
    }
  }

  // Drain the harness's JSON-line protocol from stdout.
  const reader = child.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value)
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line.length > 0) {
        await handleMessage(JSON.parse(line))
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const status = await child.status
  await Deno.remove(harnessPath).catch(() => {})
  return status.code
}
