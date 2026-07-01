import { join } from '@std/path/join'

type RunDebugSessionArgs = {
  /** Absolute path to the project dir (`.skmtc/<project>`). */
  projectPath: string
  /** The parsed, clone-safe schema document (`{ type: 'oas' | 'gql', value }`). */
  document: unknown
  /** The project's `client.json#settings`. */
  clientSettings: unknown
  /** Run to completion immediately, without waiting for a debugger to attach. */
  auto: boolean
}

/**
 * The debug harness — the program `deno run --config <project>/deno.json` runs.
 *
 * Unlike normal `generate` (which runs the compiled `bundle.js` inside a sandboxed
 * Worker), `--debug` runs the generators **in this isolate**. That is the whole
 * point: with `--config <project>/deno.json` the harness resolves the project's own
 * import map, so `@skmtc/core` and each `@skmtc/gen-*` clone load as their own
 * source modules and breakpoints in generator `.ts` files bind 1:1 — no worker, no
 * bundle, no source maps, and a plain `--inspect-wait` gives the standard
 * "wait for the debugger, then run" flow (no bespoke handshake).
 *
 * It reconstructs the generator set the same way `worker.ts` does — the
 * `@skmtc/gen-*` entries in the project's import map, each default-exporting its
 * generator keyed by `id` — then calls `toArtifacts` with `inspect: true` so a
 * paused debugger can read the live `context.inspectedFiles` map.
 *
 * `--debug` is **non-destructive**: it generates in memory and writes only the
 * inspection snapshot, never the output tree (repeated debug runs must not churn
 * the repo). Use plain `skmtc generate` to write files.
 */
const DEBUG_HARNESS_SOURCE = `
import { StackTrail, toArtifacts } from '@skmtc/core'

const [payloadPath, inspectionPath] = Deno.args
const payload = JSON.parse(Deno.readTextFileSync(payloadPath))
const { document, clientSettings, projectPath } = payload

// Reconstruct the generator set from the project's import map (same set worker.ts
// builds). Running them in THIS isolate is what makes breakpoints bind directly.
const denoJson = JSON.parse(Deno.readTextFileSync(projectPath + '/deno.json'))
const genKeys = Object.keys(denoJson.imports ?? {}).filter(key => /^@skmtc\\/gen-/.test(key))
const gens = []
for (const key of genKeys) {
  const mod = await import(key)
  if (mod.default) gens.push(mod.default)
}
console.error('Debugging ' + gens.length + ' generator(s): ' + gens.map(g => g.id).join(', '))

const result = toArtifacts({
  traceId: 'debug',
  spanId: 'debug',
  startAt: Date.now(),
  document,
  settings: clientSettings,
  stackTrail: new StackTrail(['debug', 'debug']),
  toGeneratorConfigMap: () => Object.fromEntries(gens.map(g => [g.id, g])),
  silent: true,
  inspect: true
})

const artifacts = result.artifacts ?? {}

// Non-destructive: write only the inspection snapshot (rendered text + the live
// object graph, keyed by path) — never the output tree.
if (inspectionPath) {
  Deno.writeTextFileSync(
    inspectionPath,
    JSON.stringify({ artifacts, inspection: result.inspection, sidecars: {} })
  )
}

const inspectionFiles = result.inspection
  ? Object.keys(result.inspection).filter(key => key !== '__class').length
  : 0
console.error('Generation complete — ' + Object.keys(artifacts).length + ' file(s) generated (in memory).')
if (inspectionPath) {
  console.error('Inspection snapshot: ' + inspectionFiles + ' file(s) -> ' + inspectionPath)
}
`

/**
 * Run a debuggable generation.
 *
 * Writes the harness + the schema payload to temp files and runs
 * `deno run --config <project>/deno.json [--inspect-wait] <harness> <payload>`.
 * With `auto`, it runs straight through; otherwise Deno waits for a debugger to
 * attach (the URL is printed on stderr, standard `--inspect-wait` behaviour) and
 * runs on attach. Resolves with the subprocess exit code.
 */
export const runDebugSession = async ({
  projectPath,
  document,
  clientSettings,
  auto
}: RunDebugSessionArgs): Promise<number> => {
  const harnessPath = await Deno.makeTempFile({ prefix: 'skmtc-debug-', suffix: '.ts' })
  await Deno.writeTextFile(harnessPath, DEBUG_HARNESS_SOURCE)

  const payloadPath = await Deno.makeTempFile({ prefix: 'skmtc-payload-', suffix: '.json' })
  await Deno.writeTextFile(payloadPath, JSON.stringify({ document, clientSettings, projectPath }))

  const inspectionPath = await Deno.makeTempFile({ prefix: 'skmtc-inspection-', suffix: '.json' })

  const args = ['run', '--config', join(projectPath, 'deno.json'), '-A']
  if (!auto) {
    // Standard "pause until a debugger connects, then run" — the same flow as
    // `node --inspect-brk`. Deno prints the ws:// URL on stderr; on attach the
    // generators run and breakpoints in generator .ts files hit.
    args.push('--inspect-wait=127.0.0.1:0')
  }
  args.push(harnessPath, payloadPath, inspectionPath)

  if (!auto) {
    console.log(
      '\nGenerating under the debugger — Deno will wait for a debugger to attach, then run.'
    )
    console.log('Set breakpoints in your generator .ts files; generation starts on attach.\n')
  }

  const command = new Deno.Command('deno', {
    args,
    env: { ...Deno.env.toObject() },
    stdout: 'inherit',
    stderr: 'inherit'
  })

  const child = command.spawn()
  const status = await child.status

  await Deno.remove(harnessPath).catch(() => {})
  await Deno.remove(payloadPath).catch(() => {})
  return status.code
}
