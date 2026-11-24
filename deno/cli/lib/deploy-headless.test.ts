import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert'
import {
  DEPLOY_TIMEOUT_MS,
  deployHeadless,
  type DeployHeadlessResult,
  deployVersion,
  EXISTS_TIMEOUT_MS,
  resolveStackName,
  resolveStackVersion,
  toDeployedLines,
  toDeployExitCode,
  toNextPatchVersion,
  uploadVersion
} from '@/lib/deploy-headless.ts'
import type { SourceFile } from '@/lib/source-upload.ts'
import { NoServerForCoreError, type ServerPinChange } from '@/lib/publish-server-pin.ts'
import { join } from '@std/path/join'
import {
  type HubCall,
  makeStackProject,
  stackVersionPayload,
  toJsonResponse,
  toPinnedImports,
  toStackServer,
  toVersionsPage,
  withStackHub
} from '@/tests/mocks/stack-hub.mock.ts'
import {
  recordTimeouts,
  withNeverAnsweringFetch,
  withStallingBodyFetch
} from '@/tests/mocks/never-answering-fetch.mock.ts'

const originalFetch = globalThis.fetch

const toArrayBuffer = (text: string): ArrayBuffer => {
  const u8 = new TextEncoder().encode(text)
  const buf = new ArrayBuffer(u8.byteLength)
  new Uint8Array(buf).set(u8)
  return buf
}

const createSourceFiles = (): SourceFile[] => [
  {
    path: 'deno.json',
    bytes: toArrayBuffer('{}'),
    contentType: 'application/json'
  },
  {
    path: 'src/mod.ts',
    bytes: toArrayBuffer('export {}'),
    contentType: 'text/plain'
  }
]

const noRefresh = () => Promise.resolve()

const VERSION_PATH = '/v1/stacks/acme/my-api/versions/3.0.1'
const UPLOAD_PATH = '/v1/stacks/acme/my-api/versions'
const DEPLOY_PATH = '/v1/stacks/acme/my-api/servers'

const toFailed = (result: DeployHeadlessResult) => {
  if (result.type !== 'failed') throw new Error(`expected a failed result, got ${result.type}`)
  return result
}

const toDeployed = (result: DeployHeadlessResult) => {
  if (result.type !== 'deployed')
    throw new Error(`expected a deployed result: ${JSON.stringify(result)}`)
  return result
}

/** Run a full deploy of the fixture project against `answers`. */
const runDeploy = async (
  answers: Parameters<typeof withStackHub>[0],
  { existing = false, version }: { existing?: boolean; version?: string } = {}
) => {
  await using project = await makeStackProject()
  let result: DeployHeadlessResult | undefined
  const calls = await withStackHub(answers, async () => {
    result = await deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      origin: 'https://hub.test',
      existing,
      version,
      refreshLock: noRefresh
    })
  })
  if (!result) throw new Error('deployHeadless returned nothing')
  return { result, calls }
}

Deno.test('uploadVersion - POSTs multipart version + files to the versions endpoint', async () => {
  let fetchUrl: string | undefined
  let fetchOptions: RequestInit | undefined

  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    fetchUrl = url.toString()
    fetchOptions = options
    return toJsonResponse(stackVersionPayload, 201)
  }

  try {
    const result = await uploadVersion({
      origin: 'https://hub.test',
      token: 'pat-123',
      account: 'acme',
      slug: 'my-api',
      version: '3.0.1',
      invocation: { projectName: 'my-api' },
      files: createSourceFiles()
    })

    assertEquals(fetchUrl, 'https://hub.test/v1/stacks/acme/my-api/versions')
    assertEquals(fetchOptions?.method, 'POST')

    const body = fetchOptions?.body
    if (!(body instanceof FormData)) {
      throw new Error('expected a FormData body')
    }
    assertEquals(body.get('version'), '3.0.1')
    assertEquals(body.get('bundle'), null)

    const fileParts = body.getAll('files')
    const filenames = fileParts.map(part => (part instanceof File ? part.name : ''))
    assertEquals(filenames, ['deno.json', 'src/mod.ts'])

    assertEquals(result, {
      version: '3.0.1',
      upload: {
        versionUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1',
        sourceHash: 'cafef00d',
        sourceFileCount: 2,
        sourceTotalBytes: 11
      }
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('uploadVersion - a 409 is the version-exists recipe, never "published"', async () => {
  globalThis.fetch = async () =>
    toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)

  try {
    const error = await assertRejects(() =>
      uploadVersion({
        origin: 'https://hub.test',
        token: 'pat-123',
        account: 'acme',
        slug: 'my-api',
        version: '3.0.1',
        invocation: { projectName: 'my-api' },
        files: createSourceFiles()
      })
    )

    if (!(error instanceof Error)) throw new Error('expected an Error')
    assertStringIncludes(error.message, 'Version 3.0.1 already exists.')
    assertStringIncludes(error.message, '`skmtc deploy my-api --existing`')
    assertStringIncludes(error.message, 'version exists')
    assertEquals(error.message.includes('publish'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resolveStackVersion - the --version flag wins over deno.json', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: '1.0.0' }))
    assertEquals(await resolveStackVersion({ projectPath, versionFlag: ' 2.0.0 ' }), {
      version: '2.0.0',
      fromFlag: true
    })
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackVersion - falls back to the project deno.json version', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: ' 1.2.3 ' }))
    assertEquals(await resolveStackVersion({ projectPath }), { version: '1.2.3', fromFlag: false })
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackVersion - throws the recipe when no version exists anywhere', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports: {} }))
    const error = await assertRejects(() => resolveStackVersion({ projectPath }))
    if (!(error instanceof Error)) throw new Error('expected an Error')
    assertStringIncludes(error.message, "set a `version` in the project's deno.json")
    assertStringIncludes(error.message, '--version')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackName - parses @account/slug from deno.json#name', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({ name: '@acme-org/petstore', version: '1.0.0' })
    )
    assertEquals(await resolveStackName(projectPath), { account: 'acme-org', slug: 'petstore' })
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackName - throws the recipe when name is missing', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: '1.0.0' }))
    const error = await assertRejects(() => resolveStackName(projectPath))
    if (!(error instanceof Error)) throw new Error('expected an Error')
    assertStringIncludes(error.message, 'set `name`')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test("resolveStackName - rejects a name that isn't @account/slug", async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ name: 'petstore' }))
    await assertRejects(() => resolveStackName(projectPath))
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('deployHeadless - missing version fails before any network call', async () => {
  await using project = await makeStackProject({ name: '@acme/my-api' })
  const calls = await withStackHub({}, async () => {
    const result = toFailed(
      await deployHeadless({
        skmtcRoot: project.skmtcRoot,
        projectName: 'my-api',
        token: 'pat-123'
      })
    )
    assertEquals(result.stage, 'version')
    assertEquals(result.stored, false)
    assertStringIncludes(result.reason, "set a `version` in the project's deno.json")
  })
  assertEquals(calls, [])
})

Deno.test('deployHeadless - fails at the source stage when deno.lock is missing', async () => {
  await using project = await makeStackProject()
  await Deno.remove(join(project.projectPath, 'deno.lock'))
  const calls = await withStackHub({}, async () => {
    const result = toFailed(
      await deployHeadless({
        skmtcRoot: project.skmtcRoot,
        projectName: 'my-api',
        token: 'pat-123'
      })
    )
    assertEquals(result.stage, 'source')
    assertStringIncludes(result.reason, 'deno.lock not found')
  })
  // The version check runs; nothing is uploaded.
  assertEquals(
    calls.map(call => call.method),
    ['GET']
  )
})

Deno.test('deployHeadless - pins @skmtc/server before upload and refreshes the lock', async () => {
  await using project = await makeStackProject({
    name: '@acme/my-api',
    version: '3.0.1',
    imports: {}
  })
  const refreshed: string[] = []
  let result: DeployHeadlessResult | undefined
  const calls = await withStackHub({}, async () => {
    result = await deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      refreshLock: path => {
        refreshed.push(path)
        return Promise.resolve()
      }
    })
  })

  assertEquals(result?.type, 'deployed')
  assertEquals(refreshed, [project.projectPath])
  // The hub reads the pin from the upload, so check the uploaded copy.
  const form = calls.find(call => call.body instanceof FormData)?.body
  if (!(form instanceof FormData)) throw new Error('expected an upload')
  const part = form.getAll('files').find(file => file instanceof File && file.name === 'deno.json')
  if (!(part instanceof File)) throw new Error('expected deno.json in the upload')
  assertStringIncludes(await part.text(), '"@skmtc/server": "jsr:@skmtc/server@')
})

Deno.test('deployHeadless - a new version: check, upload, then deploy { version } only', async () => {
  const { result, calls } = await runDeploy({})

  assertEquals(
    calls.map(call => `${call.method} ${call.path}`),
    [`GET ${VERSION_PATH}`, `POST ${UPLOAD_PATH}`, `POST ${DEPLOY_PATH}`]
  )
  const deployBody = calls[2].body
  if (typeof deployBody !== 'string') throw new Error('expected a JSON body')
  const parsed: unknown = JSON.parse(deployBody)
  assertEquals(parsed, { version: '3.0.1' })
  assertEquals(typeof parsed === 'object' && parsed !== null && 'promote' in parsed, false)

  const deployed = toDeployed(result)
  assertEquals(deployed.version, '3.0.1')
  assertEquals(deployed.versionPicked, false)
  assertEquals(deployed.upload?.sourceHash, 'cafef00d')
  assertEquals(deployed.deploy, {
    status: 'active',
    statusReason: null,
    endpointUrl: 'https://acme-my-api.deno.dev/api',
    url: 'https://api.skmtc.dev/v1/stacks/acme/my-api/servers/3.0.1'
  })
  assertEquals(toDeployExitCode(result), 0)

  const lines = toDeployedLines(deployed)
  assertStringIncludes(lines[0], 'acme/my-api@3.0.1')
  const deployIndex = lines.indexOf('deploy: active')
  assertEquals(deployIndex > 0, true)
})

Deno.test('deployHeadless - the check and the deploy use their own timeouts', async () => {
  const timeouts = await recordTimeouts(() => runDeploy({}))
  assertEquals(timeouts, [EXISTS_TIMEOUT_MS, DEPLOY_TIMEOUT_MS])
  assertEquals(DEPLOY_TIMEOUT_MS, 120_000)
  assertEquals(EXISTS_TIMEOUT_MS, 20_000)
})

Deno.test('deployHeadless - status error shows the reason, says the version is stored, exit 1', async () => {
  const { result } = await runDeploy({
    deploy: () =>
      toJsonResponse(
        toStackServer({ status: 'error', statusReason: 'Module not found: x.ts' }),
        201
      )
  })

  const deployed = toDeployed(result)
  assertEquals(deployed.deploy.status, 'error')
  assertEquals(deployed.deploy.statusReason, 'Module not found: x.ts')
  assertEquals(toDeployExitCode(result), 1)
  const text = toDeployedLines(deployed).join('\n')
  assertStringIncludes(text, 'deploy: error')
  assertStringIncludes(text, 'Module not found: x.ts')
  assertStringIncludes(text, 'Version 3.0.1 is stored')
  assertStringIncludes(text, 'bump `version`')
})

for (const status of ['deploying', 'idle', 'paused'] as const) {
  Deno.test(`deployHeadless - status ${status} prints as returned and exits 0`, async () => {
    const { result } = await runDeploy({
      deploy: () => toJsonResponse(toStackServer({ status }), 201)
    })
    assertEquals(toDeployExitCode(result), 0)
    assertEquals(toDeployedLines(toDeployed(result)).includes(`deploy: ${status}`), true)
  })
}

Deno.test('deployHeadless - a 409 from the deploy says still deploying: wait, then --existing', async () => {
  const { result } = await runDeploy({
    deploy: () =>
      toJsonResponse(
        { message: "Stack version '3.0.1' is already deploying - retry shortly." },
        409
      )
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'deploy')
  assertEquals(failed.stored, true)
  assertStringIncludes(failed.reason, 'Version 3.0.1 is stored and is still deploying')
  assertStringIncludes(failed.reason, '`skmtc deploy my-api --existing`')
  assertEquals(failed.reason.includes('bump'), false)
  assertEquals(toDeployExitCode(result), 1)
})

for (const status of [400, 404, 422]) {
  Deno.test(`deployHeadless - a ${status} from the deploy says stored, fix and bump, exit 1`, async () => {
    const reason = "Stack version '3.0.1' failed to deploy: Module not found: x.ts"
    const { result } = await runDeploy({
      deploy: () => toJsonResponse({ code: 'x', message: reason }, status)
    })

    const failed = toFailed(result)
    assertEquals(failed.stage, 'deploy')
    assertEquals(failed.stored, true)
    assertStringIncludes(failed.reason, reason)
    assertStringIncludes(failed.reason, 'Version 3.0.1 is stored')
    assertStringIncludes(failed.reason, 'Fix the problem, bump `version`')
    assertEquals(toDeployExitCode(result), 1)
  })
}

for (const status of [401, 403]) {
  Deno.test(`deployHeadless - a ${status} from the deploy says stored, refused, write:releases`, async () => {
    const { result } = await runDeploy({
      deploy: () => toJsonResponse({ code: 'forbidden', message: 'missing scope' }, status)
    })

    const failed = toFailed(result)
    assertEquals(failed.stage, 'deploy')
    assertEquals(failed.stored, true)
    assertStringIncludes(failed.reason, 'Version 3.0.1 is stored, but the hub refused the deploy')
    assertStringIncludes(failed.reason, '`write:releases`')
    assertEquals(toDeployExitCode(result), 1)
  })
}

Deno.test('deployVersion - no answer is "deploy not confirmed" with the --existing hint', async () => {
  const outcome = await withNeverAnsweringFetch(() =>
    deployVersion({
      origin: 'https://hub.test',
      token: 'pat-123',
      account: 'acme',
      slug: 'my-api',
      version: '3.0.1',
      invocation: { projectName: 'my-api' },
      timeoutMs: 10
    })
  )
  if (outcome.type !== 'failed') throw new Error('expected a failure')
  assertEquals(outcome.stored, true)
  assertStringIncludes(outcome.reason, 'deploy not confirmed')
  assertStringIncludes(outcome.reason, 'Version 3.0.1 is stored')
  assertStringIncludes(outcome.reason, '`skmtc deploy my-api --existing`')
})

Deno.test('deployVersion - a stalled body counts as "deploy not confirmed"', async () => {
  const outcome = await withStallingBodyFetch(201, () =>
    deployVersion({
      origin: 'https://hub.test',
      token: 'pat-123',
      account: 'acme',
      slug: 'my-api',
      version: '3.0.1',
      invocation: { projectName: 'my-api' },
      timeoutMs: 10
    })
  )
  if (outcome.type !== 'failed') throw new Error('expected a failure')
  assertStringIncludes(outcome.reason, 'deploy not confirmed')
  assertStringIncludes(outcome.reason, 'did not answer within')
})

Deno.test('deployHeadless - a stored --version exits 2 and uploads nothing', async () => {
  const { result, calls } = await runDeploy(
    { exists: () => toJsonResponse(stackVersionPayload, 200) },
    { version: '3.0.1' }
  )

  const failed = toFailed(result)
  assertEquals(failed.stage, 'exists')
  assertEquals(failed.stored, true)
  assertEquals(
    failed.reason,
    'Version 3.0.1 already exists. Pass another `--version`, run ' +
      '`skmtc deploy my-api` to deploy the deno.json version (or the next patch when it is stored), or run ' +
      '`skmtc deploy my-api --version 3.0.1 --existing` to deploy the stored version.'
  )
  assertEquals(toDeployExitCode(result), 2)
  assertEquals(
    calls.map(call => call.method),
    ['GET']
  )
})

Deno.test('deployHeadless - a 403 from the version check goes on to the upload', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse({ code: 'forbidden' }, 403)
  })
  assertEquals(result.type, 'deployed')
  assertEquals(calls.length, 3)
})

Deno.test('deployHeadless - a 403 check then a 409 upload of a --version is the same recipe, exit 2', async () => {
  const { result, calls } = await runDeploy(
    {
      exists: () => toJsonResponse({ code: 'forbidden' }, 403),
      upload: () => toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)
    },
    { version: '3.0.1' }
  )

  const failed = toFailed(result)
  assertEquals(failed.stage, 'exists')
  assertEquals(failed.stored, true)
  assertStringIncludes(failed.reason, 'Version 3.0.1 already exists.')
  assertEquals(toDeployExitCode(result), 2)
  // Never deployed.
  assertEquals(calls.map(call => call.path).includes(DEPLOY_PATH), false)
})

Deno.test('deployHeadless - --existing only calls the deploy route', async () => {
  const { result, calls } = await runDeploy({}, { existing: true })

  assertEquals(
    calls.map(call => `${call.method} ${call.path}`),
    [`POST ${DEPLOY_PATH}`]
  )
  const deployed = toDeployed(result)
  assertEquals(deployed.upload, null)
  assertEquals(toDeployExitCode(result), 0)
  assertStringIncludes(toDeployedLines(deployed)[0], 'Already stored acme/my-api@3.0.1')
})

Deno.test('deployHeadless - --existing and a 404 says to drop --existing', async () => {
  const { result } = await runDeploy(
    { deploy: () => toJsonResponse({ code: 'x', message: 'no such version' }, 404) },
    { existing: true }
  )

  const failed = toFailed(result)
  assertEquals(failed.stage, 'deploy')
  assertEquals(failed.stored, false)
  assertStringIncludes(failed.reason, 'no such version')
  assertStringIncludes(failed.reason, 'run `skmtc deploy my-api` without `--existing`')
  assertEquals(toDeployExitCode(result), 1)
})

Deno.test('deployHeadless - --existing and a 422 build failure says stored, fix and bump', async () => {
  const reason = "Stack version '3.0.1' failed to deploy: Module not found: x.ts"
  const { result } = await runDeploy(
    { deploy: () => toJsonResponse({ message: reason }, 422) },
    { existing: true }
  )

  const failed = toFailed(result)
  assertEquals(failed.stored, true)
  assertStringIncludes(failed.reason, reason)
  assertStringIncludes(failed.reason, 'Fix the problem, bump `version`')
  assertEquals(failed.reason.includes('without `--existing`'), false)
})

Deno.test("deployHeadless - suggested commands keep this run's --version and --env", async () => {
  await using project = await makeStackProject()
  let outcome: DeployHeadlessResult | undefined
  await withStackHub({ deploy: () => toJsonResponse({ message: 'down' }, 503) }, async () => {
    outcome = await deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      origin: 'https://hub.test',
      version: '2.0.0',
      envFlag: 'staging',
      existing: true
    })
  })
  if (!outcome) throw new Error('deployHeadless returned nothing')
  assertStringIncludes(
    toFailed(outcome).reason,
    '`skmtc deploy my-api --version 2.0.0 --env staging --existing`'
  )
})

Deno.test('deployHeadless - --existing and a 404 keeps --version in the upload command', async () => {
  await using project = await makeStackProject()
  let outcome: DeployHeadlessResult | undefined
  await withStackHub(
    { deploy: () => toJsonResponse({ message: 'no such version' }, 404) },
    async () => {
      outcome = await deployHeadless({
        skmtcRoot: project.skmtcRoot,
        projectName: 'my-api',
        token: 'pat-123',
        origin: 'https://hub.test',
        version: '2.0.0',
        envFlag: 'staging',
        existing: true
      })
    }
  )
  if (!outcome) throw new Error('deployHeadless returned nothing')
  assertStringIncludes(
    toFailed(outcome).reason,
    'run `skmtc deploy my-api --version 2.0.0 --env staging` without `--existing`'
  )
})

Deno.test('deployHeadless - the hub URLs encode the stack name', async () => {
  await using project = await makeStackProject({
    name: '@acme/my-api#2',
    version: '3.0.1',
    imports: toPinnedImports()
  })
  const calls = await withStackHub({}, () =>
    deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      origin: 'https://hub.test',
      refreshLock: noRefresh
    })
  )
  assertEquals(
    calls.map(call => call.path),
    [
      '/v1/stacks/acme/my-api%232/versions/3.0.1',
      '/v1/stacks/acme/my-api%232/versions',
      '/v1/stacks/acme/my-api%232/servers'
    ]
  )
})

for (const status of [500, 502, 503]) {
  Deno.test(`deployHeadless - a ${status} from the deploy says to deploy again, not to bump`, async () => {
    const { result } = await runDeploy({
      deploy: () => toJsonResponse({ code: 'x', message: 'bad gateway' }, status)
    })

    const failed = toFailed(result)
    assertEquals(failed.stored, true)
    assertStringIncludes(failed.reason, 'Version 3.0.1 is stored')
    assertStringIncludes(failed.reason, '`skmtc deploy my-api --existing`')
    assertEquals(failed.reason.includes('bump'), false)
    assertEquals(toDeployExitCode(result), 1)
  })
}

Deno.test('deployHeadless - a hub message ending in a period gets no second one', async () => {
  const { result } = await runDeploy({
    deploy: () => toJsonResponse({ message: 'Module not found.', requestId: 'req-42' }, 422)
  })
  const reason = toFailed(result).reason
  assertStringIncludes(reason, 'Module not found. (request id: req-42)')
  assertEquals(reason.includes('..'), false)
})

for (const answers of [
  { deploy: () => toJsonResponse({ message: 'no' }, 403) },
  { deploy: () => toJsonResponse({ message: 'down' }, 503) }
]) {
  Deno.test('deployHeadless - with --existing, a refused or failed deploy is still stored', async () => {
    const { result } = await runDeploy(answers, { existing: true })
    assertEquals(toFailed(result).stored, true)
  })
}

Deno.test('deployVersion - with --existing, no answer is still stored', async () => {
  const outcome = await withNeverAnsweringFetch(() =>
    deployVersion({
      origin: 'https://hub.test',
      token: 'pat-123',
      account: 'acme',
      slug: 'my-api',
      version: '3.0.1',
      invocation: { projectName: 'my-api' },
      existing: true,
      timeoutMs: 10
    })
  )
  if (outcome.type !== 'failed') throw new Error('expected a failure')
  assertEquals(outcome.stored, true)
})

Deno.test('deployHeadless - a 2xx upload with an unreadable body is stored and not deployed', async () => {
  const { result, calls } = await runDeploy({
    upload: () => new Response('not json', { status: 201 })
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'upload')
  assertEquals(failed.stored, true)
  assertStringIncludes(failed.reason, '`skmtc deploy my-api --existing`')
  assertEquals(calls.map(call => call.path).includes(DEPLOY_PATH), false)
})

Deno.test('deployHeadless - deploys and reports the version as the hub stored it', async () => {
  const { result, calls } = await runDeploy(
    { upload: () => toJsonResponse(stackVersionPayload, 201) },
    { version: 'v3.0.1' }
  )

  const deployBody = calls.find(call => call.path === DEPLOY_PATH)?.body
  if (typeof deployBody !== 'string') throw new Error('expected a deploy body')
  assertEquals(JSON.parse(deployBody), { version: '3.0.1' })
  assertEquals(toDeployed(result).version, '3.0.1')
})

/** A deploy of the fixture project with `pinServer` in place of the registry lookup. */
const runDeployWithPin = async (
  pinServer: (projectPath: string) => Promise<ServerPinChange | null>
) => {
  await using project = await makeStackProject()
  let result: DeployHeadlessResult | undefined
  let refreshed = 0
  const calls = await withStackHub({}, async () => {
    result = await deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      origin: 'https://hub.test',
      refreshLock: () => {
        refreshed += 1
        return Promise.resolve()
      },
      pinServer
    })
  })
  if (!result) throw new Error('deployHeadless returned nothing')
  return { result, calls, refreshed }
}

Deno.test(
  'deployHeadless - a changed server pin refreshes the lock and is in the result',
  async () => {
    const change: ServerPinChange = {
      package: '@skmtc/server',
      from: 'jsr:@skmtc/server@0.3.34',
      to: 'jsr:@skmtc/server@0.3.33'
    }
    const { result, refreshed } = await runDeployWithPin(() => Promise.resolve(change))

    assertEquals(refreshed, 1)
    // `--json` prints the result, so the change is reported there too.
    assertEquals(toDeployed(result).serverPin, change)
  }
)

Deno.test('deployHeadless - no server for the project core stops before the upload', async () => {
  const { result, calls } = await runDeployWithPin(() =>
    Promise.reject(new NoServerForCoreError({ core: '0.43.0', tried: ['0.3.34', '0.3.32'], reason: 'no-server' }))
  )

  const failed = toFailed(result)
  assertEquals(failed.stage, 'source')
  assertEquals(failed.stored, false)
  assertStringIncludes(failed.reason, "accepts the project's @skmtc/core 0.43.0")
  assertEquals(
    calls.some(call => call.method === 'POST'),
    false
  )
})

Deno.test('deployHeadless - a failure after the server pin changed still reports the pin', async () => {
  const change: ServerPinChange = {
    package: '@skmtc/server',
    from: null,
    to: 'jsr:@skmtc/server@0.3.33'
  }
  await using project = await makeStackProject()
  let result: DeployHeadlessResult | undefined
  await withStackHub({}, async () => {
    result = await deployHeadless({
      skmtcRoot: project.skmtcRoot,
      projectName: 'my-api',
      token: 'pat-123',
      origin: 'https://hub.test',
      refreshLock: () => Promise.reject(new Error('deno install failed')),
      pinServer: () => Promise.resolve(change)
    })
  })
  if (!result) throw new Error('deployHeadless returned nothing')

  const failed = toFailed(result)
  assertEquals(failed.stage, 'source')
  // deno.json has already changed, so --json says so.
  assertEquals(failed.serverPin, change)
})

Deno.test('toNextPatchVersion - the next patch after the newest release, by semver', () => {
  assertEquals(toNextPatchVersion(['0.1.5', '0.2.0']), '0.2.1')
  // Not by string order, not by list order.
  assertEquals(toNextPatchVersion(['0.10.0', '0.9.0', '0.2.0']), '0.10.1')
  // A prerelease is never the newest one.
  assertEquals(toNextPatchVersion(['1.0.0', '2.0.0-beta.1']), '1.0.1')
  assertEquals(toNextPatchVersion(['2.0.0-beta.1', 'not-semver']), null)
  assertEquals(toNextPatchVersion([]), null)
})

const UPLOADED_VERSIONS = (calls: HubCall[]) =>
  calls.flatMap(call =>
    call.method === 'POST' && call.body instanceof FormData ? [call.body.get('version')] : []
  )

/** Run `fn` with `console.error` recorded, and return what it printed. */
const recordStderr = async (fn: () => Promise<unknown>): Promise<string[]> => {
  const originalError = console.error
  const lines: string[] = []
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  try {
    await fn()
    return lines
  } finally {
    console.error = originalError
  }
}

Deno.test(
  'deployHeadless - a stored deno.json version deploys the next patch after the newest stored version',
  async () => {
    const cursors: (string | null)[] = []
    let outcome: Awaited<ReturnType<typeof runDeploy>> | undefined
    const stderr = await recordStderr(async () => {
      outcome = await runDeploy({
        exists: () => toJsonResponse(stackVersionPayload, 200),
        // Two pages; the newest release is on the second page.
        versions: cursor => {
          cursors.push(cursor)
          return cursor === null
            ? toVersionsPage(['3.0.1', '3.2.9'], 'page-2')
            : toVersionsPage(['3.10.0', '3.11.0-beta.1'])
        }
      })
    })
    if (!outcome) throw new Error('runDeploy returned nothing')
    const { result, calls } = outcome

    assertEquals(cursors, [null, 'page-2'])
    assertEquals(
      calls.map(call => `${call.method} ${call.path}`),
      [
        `GET ${VERSION_PATH}`,
        `GET ${UPLOAD_PATH}`,
        `GET ${UPLOAD_PATH}`,
        `POST ${UPLOAD_PATH}`,
        `POST ${DEPLOY_PATH}`
      ]
    )
    // Not 3.0.2, the next patch after the deno.json version.
    assertEquals(UPLOADED_VERSIONS(calls), ['3.10.1'])
    const deployBody = calls.find(call => call.path === DEPLOY_PATH)?.body
    if (typeof deployBody !== 'string') throw new Error('expected a deploy body')
    assertEquals(JSON.parse(deployBody), { version: '3.10.1' })

    const deployed = toDeployed(result)
    assertEquals(deployed.version, '3.10.1')
    assertEquals(deployed.versionPicked, true)
    assertEquals(toDeployExitCode(result), 0)
    assertEquals(stderr.includes('Version 3.0.1 is stored: deploying 3.10.1.'), true)
    assertStringIncludes(toDeployedLines(deployed).join('\n'), 'picked:')
  }
)

Deno.test('deployHeadless - a picked version keeps --version in the suggested commands', async () => {
  let outcome: Awaited<ReturnType<typeof runDeploy>> | undefined
  await recordStderr(async () => {
    outcome = await runDeploy({
      exists: () => toJsonResponse(stackVersionPayload, 200),
      versions: () => toVersionsPage(['3.0.1']),
      deploy: () => toJsonResponse({ message: 'boom' }, 503)
    })
  })
  if (!outcome) throw new Error('runDeploy returned nothing')
  // Without --version the command would deploy the deno.json version, 3.0.1.
  assertStringIncludes(
    toFailed(outcome.result).reason,
    '`skmtc deploy my-api --version 3.0.2 --existing`'
  )
})

Deno.test('deployHeadless - the CLI does not write the picked version into deno.json', async () => {
  await using project = await makeStackProject()
  const before = await Deno.readTextFile(join(project.projectPath, 'deno.json'))
  let result: DeployHeadlessResult | undefined
  await recordStderr(() =>
    withStackHub({ exists: () => toJsonResponse(stackVersionPayload, 200) }, async () => {
      result = await deployHeadless({
        skmtcRoot: project.skmtcRoot,
        projectName: 'my-api',
        token: 'pat-123',
        origin: 'https://hub.test',
        refreshLock: noRefresh
      })
    })
  )
  if (!result) throw new Error('deployHeadless returned nothing')
  assertEquals(toDeployed(result).versionPicked, true)
  assertEquals(await Deno.readTextFile(join(project.projectPath, 'deno.json')), before)
})

Deno.test('deployHeadless - a deno.json version that is not stored deploys as it is', async () => {
  const { result, calls } = await runDeploy({
    versions: () => toVersionsPage(['9.9.9'])
  })

  // The versions list is not read.
  assertEquals(
    calls.some(call => call.method === 'GET' && call.path === UPLOAD_PATH),
    false
  )
  assertEquals(UPLOADED_VERSIONS(calls), ['3.0.1'])
  const deployed = toDeployed(result)
  assertEquals(deployed.version, '3.0.1')
  assertEquals(deployed.versionPicked, false)
})

Deno.test('deployHeadless - a versions list that cannot be read stops before the upload, exit 1', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200),
    versions: () => toJsonResponse({ message: 'missing scope' }, 403)
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'version')
  assertStringIncludes(failed.reason, 'Version 3.0.1 is stored')
  assertStringIncludes(failed.reason, 'missing scope')
  assertStringIncludes(failed.reason, '--version <semver>')
  assertEquals(toDeployExitCode(result), 1)
  assertEquals(
    calls.some(call => call.method === 'POST'),
    false
  )
})

Deno.test('deployHeadless - a versions page with more pages but no cursor stops before the upload', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200),
    versions: () =>
      toJsonResponse({ items: [{ version: '3.0.1' }], pagination: { hasMore: true } }, 200)
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'version')
  assertStringIncludes(failed.reason, 'more pages but no cursor')
  assertEquals(
    calls.some(call => call.method === 'POST'),
    false
  )
})

Deno.test('deployHeadless - a 409 on the upload of a picked version picks again once', async () => {
  let uploads = 0
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200),
    versions: () => toVersionsPage(['3.0.1']),
    upload: () => {
      uploads += 1
      return uploads === 1
        ? toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)
        : toJsonResponse({ ...stackVersionPayload, version: '3.0.3' }, 201)
    }
  })

  // 3.0.2 was stored by another deploy; the list does not show it yet.
  assertEquals(UPLOADED_VERSIONS(calls), ['3.0.2', '3.0.3'])
  const deployed = toDeployed(result)
  assertEquals(deployed.version, '3.0.3')
  assertEquals(deployed.versionPicked, true)
})

Deno.test('deployHeadless - a 409 on the upload picks again once, then fails, exit 1', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200),
    versions: () => toVersionsPage(['3.0.1']),
    upload: () => toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)
  })

  assertEquals(UPLOADED_VERSIONS(calls), ['3.0.2', '3.0.3'])
  const failed = toFailed(result)
  assertEquals(failed.stage, 'upload')
  // Another deploy stored 3.0.3.
  assertEquals(failed.stored, true)
  assertStringIncludes(failed.reason, 'Version 3.0.3 was also stored by another deploy')
  assertStringIncludes(failed.reason, '`skmtc deploy my-api`')
  assertEquals(toDeployExitCode(result), 1)
  assertEquals(calls.map(call => call.path).includes(DEPLOY_PATH), false)
})

Deno.test('deployHeadless - a 409 on the upload of a deno.json version that was not stored picks too', async () => {
  let uploads = 0
  const { result, calls } = await runDeploy({
    upload: () => {
      uploads += 1
      return uploads === 1
        ? toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)
        : toJsonResponse({ ...stackVersionPayload, version: '3.0.2' }, 201)
    }
  })

  assertEquals(UPLOADED_VERSIONS(calls), ['3.0.1', '3.0.2'])
  const deployed = toDeployed(result)
  assertEquals(deployed.version, '3.0.2')
  assertEquals(deployed.versionPicked, true)
})
