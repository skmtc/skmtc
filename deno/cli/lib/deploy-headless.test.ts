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
  uploadVersion
} from '@/lib/deploy-headless.ts'
import type { SourceFile } from '@/lib/source-upload.ts'
import { join } from '@std/path/join'
import {
  makeStackProject,
  stackVersionPayload,
  toJsonResponse,
  toStackServer,
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
  { existing = false }: { existing?: boolean } = {}
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
      projectName: 'my-api',
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
      versionUrl: 'https://skmtc.dev/acme/stacks/my-api/versions/3.0.1',
      sourceHash: 'cafef00d',
      sourceFileCount: 2,
      sourceTotalBytes: 11
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
        projectName: 'my-api',
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
    assertEquals(await resolveStackVersion({ projectPath, versionFlag: ' 2.0.0 ' }), '2.0.0')
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
})

Deno.test('resolveStackVersion - falls back to the project deno.json version', async () => {
  const projectPath = await Deno.makeTempDir()
  try {
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ version: ' 1.2.3 ' }))
    assertEquals(await resolveStackVersion({ projectPath }), '1.2.3')
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

for (const status of [400, 404, 409, 422]) {
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
      projectName: 'my-api',
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
      projectName: 'my-api',
      timeoutMs: 10
    })
  )
  if (outcome.type !== 'failed') throw new Error('expected a failure')
  assertStringIncludes(outcome.reason, 'deploy not confirmed')
  assertStringIncludes(outcome.reason, 'did not answer within')
})

Deno.test('deployHeadless - a 200 from the version check exits 2 and uploads nothing', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse(stackVersionPayload, 200)
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'exists')
  assertEquals(
    failed.reason,
    'Version 3.0.1 already exists. Bump `version` in deno.json, or run ' +
      '`skmtc deploy my-api --existing` to deploy the stored version.'
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

Deno.test('deployHeadless - a 403 check then a 409 upload is the same recipe, exit 2', async () => {
  const { result, calls } = await runDeploy({
    exists: () => toJsonResponse({ code: 'forbidden' }, 403),
    upload: () => toJsonResponse({ code: 'conflict', message: 'version exists' }, 409)
  })

  const failed = toFailed(result)
  assertEquals(failed.stage, 'exists')
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

for (const status of [404, 422]) {
  Deno.test(`deployHeadless - --existing and a ${status} says to drop --existing`, async () => {
    const { result } = await runDeploy(
      { deploy: () => toJsonResponse({ code: 'x', message: 'no such version' }, status) },
      { existing: true }
    )

    const failed = toFailed(result)
    assertEquals(failed.stage, 'deploy')
    assertStringIncludes(failed.reason, 'no such version')
    assertStringIncludes(failed.reason, 'run `skmtc deploy my-api` without `--existing`')
    assertEquals(toDeployExitCode(result), 1)
  })
}
