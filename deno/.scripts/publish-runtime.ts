#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net --allow-run
/**
 * Build and upload the `@skmtc/server` runtime to skmtc-hub.
 *
 * Triggered from `.github/workflows/publish.yml` after a successful
 * JSR publish. The script:
 *
 *   1. Reads the just-published version from `deno/server/deno.json`.
 *   2. Probes `GET /v1/runtimes/{serverVersion}` on the hub. 200 →
 *      runtime is already materialised, exit 0 (idempotent on
 *      repeat pushes).
 *   3. In a tmp dir, writes a one-file `deno.json` that pins the
 *      published `@skmtc/server` (which itself pins `@skmtc/core` at
 *      its publish-time version) plus two re-export entry files.
 *   4. Runs `deno bundle --platform browser` for each entry. Both
 *      outputs run through `normalizeSpecifiers` so the cross-bundle
 *      `@skmtc/core` resolves to the flat `skmtc-core.js` key the
 *      runner's modules Map uses.
 *   5. PUTs each half to
 *      `/v1/runtimes/{serverVersion}/{core,server}.js`. The hub
 *      stamps `coreVersion` onto the server.js half's R2 custom
 *      metadata by reading `@skmtc/server@{X}`'s `deno.json` from
 *      JSR — the CLI doesn't have to send it.
 *
 * Env:
 *   - `SKMTC_HUB_TOKEN` (required): PAT with publish scope on the hub.
 *   - `SKMTC_HUB_URL`: default `https://api.skmtc.dev`.
 *   - `JSR_URL`: default `https://jsr.skmtc.dev/` (the local registry).
 *
 * Exit codes:
 *   - 0: runtime uploaded, or already present.
 *   - 1: anything else (build failure, hub error, etc).
 */

import { dirname, fromFileUrl, join } from '@std/path'

const REPO_ROOT = dirname(dirname(dirname(fromFileUrl(import.meta.url))))
const SERVER_DENO_JSON = join(REPO_ROOT, 'deno', 'server', 'deno.json')
const NORMALIZE_SPECIFIERS_PATH = join(REPO_ROOT, 'deno', 'cli', 'lib', 'normalize-specifiers.ts')

const DEFAULT_HUB_URL = 'https://api.skmtc.dev'
const DEFAULT_JSR_URL = 'https://jsr.skmtc.dev/'

const hubUrl = Deno.env.get('SKMTC_HUB_URL') ?? DEFAULT_HUB_URL
const jsrUrl = Deno.env.get('JSR_URL') ?? DEFAULT_JSR_URL
const token = Deno.env.get('SKMTC_HUB_TOKEN')
if (!token) {
  console.error('SKMTC_HUB_TOKEN is required')
  Deno.exit(1)
}

const readServerVersion = async (): Promise<string> => {
  const text = await Deno.readTextFile(SERVER_DENO_JSON)
  const parsed = JSON.parse(text) as { version?: unknown }
  if (typeof parsed.version !== 'string') {
    throw new Error(`expected a string "version" in ${SERVER_DENO_JSON}`)
  }
  return parsed.version
}

const runtimeAlreadyPublished = async (serverVersion: string): Promise<boolean> => {
  const response = await fetch(`${hubUrl}/v1/runtimes/${serverVersion}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  })
  if (response.ok) {
    await response.text()
    return true
  }
  if (response.status === 404) {
    await response.text()
    return false
  }
  const text = await response.text()
  throw new Error(`runtime probe failed (${response.status}): ${text.slice(0, 500)}`)
}

const runDenoBundle = async ({
  cwd,
  entry,
  output,
  externals
}: {
  cwd: string
  entry: string
  output: string
  externals: string[]
}): Promise<void> => {
  const externalArgs = externals.flatMap((spec) => ['--external', spec])
  const command = new Deno.Command('deno', {
    args: ['bundle', '--platform', 'browser', ...externalArgs, '-o', output, entry],
    cwd,
    stdout: 'piped',
    stderr: 'piped',
    env: { ...Deno.env.toObject(), JSR_URL: jsrUrl }
  })
  const { success, stderr } = await command.output()
  if (!success) {
    throw new Error(
      `deno bundle ${entry} → ${output} failed:\n${new TextDecoder().decode(stderr)}`
    )
  }
}

const putRuntimeHalf = async ({
  serverVersion,
  half,
  bytes
}: {
  serverVersion: string
  half: 'core.js' | 'server.js'
  bytes: ArrayBuffer
}): Promise<void> => {
  const url = `${hubUrl}/v1/runtimes/${serverVersion}/${half}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/javascript' },
    body: bytes
  })
  if (!response.ok) {
    const text = await response.text()
    if (response.status === 409) {
      throw new Error(
        `runtime ${serverVersion}/${half} on hub differs from the just-built ` +
          `bytes (409): ${text.slice(0, 300)}. ` +
          `A previous deploy uploaded a runtime at this version with different ` +
          `bytes — investigate before retrying.`
      )
    }
    throw new Error(`PUT ${url} failed (${response.status}): ${text.slice(0, 500)}`)
  }
  await response.text()
}

const readArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
  const u8 = await Deno.readFile(path)
  const buf = new ArrayBuffer(u8.byteLength)
  new Uint8Array(buf).set(u8)
  return buf
}

const main = async () => {
  const serverVersion = await readServerVersion()
  console.log(`@skmtc/server@${serverVersion}`)

  if (await runtimeAlreadyPublished(serverVersion)) {
    console.log(`Runtime for ${serverVersion} is already on the hub — nothing to do.`)
    return
  }

  console.log(`Building runtime for ${serverVersion}...`)
  const tmp = await Deno.makeTempDir({ prefix: `skmtc-runtime-${serverVersion}-` })

  await Deno.writeTextFile(
    join(tmp, 'deno.json'),
    JSON.stringify(
      {
        imports: {
          '@skmtc/core': `jsr:@skmtc/core@*`,
          '@skmtc/server': `jsr:@skmtc/server@${serverVersion}`
        }
      },
      null,
      2
    ) + '\n'
  )
  await Deno.writeTextFile(join(tmp, 'core.ts'), `export * from '@skmtc/core'\n`)
  await Deno.writeTextFile(join(tmp, 'server.ts'), `export * from '@skmtc/server'\n`)

  await runDenoBundle({ cwd: tmp, entry: 'core.ts', output: 'core.js', externals: [] })
  await runDenoBundle({
    cwd: tmp,
    entry: 'server.ts',
    output: 'server.js',
    externals: ['jsr:@skmtc/core@*']
  })

  // Import the CLI's normalize-specifiers from the repo checkout — both
  // halves need it so the cross-bundle `@skmtc/core` import lands at
  // the flat `skmtc-core.js` key the runner's modules Map expects.
  const { normalizeSpecifiers } = await import(NORMALIZE_SPECIFIERS_PATH)
  for (const name of ['core.js', 'server.js']) {
    const src = await Deno.readTextFile(join(tmp, name))
    const { out } = normalizeSpecifiers(src)
    await Deno.writeTextFile(join(tmp, name), out)
  }

  console.log(`Uploading core.js and server.js to ${hubUrl}/v1/runtimes/${serverVersion}/...`)
  await putRuntimeHalf({
    serverVersion,
    half: 'core.js',
    bytes: await readArrayBuffer(join(tmp, 'core.js'))
  })
  await putRuntimeHalf({
    serverVersion,
    half: 'server.js',
    bytes: await readArrayBuffer(join(tmp, 'server.js'))
  })
  console.log(`Runtime ${serverVersion} published.`)
}

await main()
