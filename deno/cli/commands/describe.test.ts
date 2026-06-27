import { assertEquals, assertStringIncludes } from '@std/assert'
import { join } from '@std/path/join'
import { printDescribeResult, renderDescribe } from './describe.ts'
import type { DescribeResult } from '@/lib/describe-headless.ts'
import { withCapturedExit } from '@/tests/strict-mode-helpers.test.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { mockClientJsonContents } from '@/tests/fixtures/client-json.fixture.ts'

const captureLogs = (fn: () => void): string[] => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg?: unknown) => logs.push(String(msg ?? ''))
  try {
    fn()
  } finally {
    console.log = original
  }
  return logs
}

const OriginalWorker = globalThis.Worker

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((error: ErrorEvent) => void) | null = null

  constructor(
    public url: string,
    public options?: WorkerOptions
  ) {}

  postMessage(_data: unknown) {}

  terminate() {}

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }
}

// Install a Worker that, once constructed, emits READY then a follow-up
// (RESULT or ERROR). describeWithWorker posts DESCRIBE on READY (a no-op
// against the mock) and settles on the follow-up message.
const installSequencedWorker = (followUp: Record<string, unknown>) => {
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => instance.simulateMessage(followUp), 0)
      }, 0)
      return instance as unknown as Worker
    }
  } as unknown as typeof Worker
}

const resultMessage = {
  type: 'RESULT',
  subjects: { '@scope/gen-x': { type: 'model', models: ['User'] } },
  descriptors: [],
  enrichmentDefaults: {},
  parseIssues: []
}

const baseResult: DescribeResult = {
  projectName: 'my-api',
  subjects: {
    '@scope/gen-x': { type: 'model', models: ['User'] }
  },
  descriptors: [
    {
      generator: '@scope/gen-x',
      subjectKind: 'model',
      supportsVariant: false,
      fields: [{ key: 'title', label: 'Title', optional: false, type: 'text' }]
    }
  ],
  enrichmentDefaults: { '@scope/gen-x': { User: { main: {} } } },
  parseIssues: []
}

Deno.test('printDescribeResult - text reports descriptor + subject counts and per-descriptor fields', () => {
  const logs = captureLogs(() => printDescribeResult(baseResult, { format: 'text' }))
  const joined = logs.join('\n')
  assertStringIncludes(
    joined,
    'describe "my-api": 1 generator descriptor(s), 1 generator(s) with supported subjects.'
  )
  assertStringIncludes(joined, '@scope/gen-x (model) — 1 field(s)')
})

Deno.test('printDescribeResult - text appends ", variants" only when the entry supports variants', () => {
  const withVariant: DescribeResult = {
    ...baseResult,
    descriptors: [
      { generator: '@scope/gen-x', subjectKind: 'operation', supportsVariant: true, fields: [] }
    ]
  }
  const variantLogs = captureLogs(() => printDescribeResult(withVariant, { format: 'text' }))
  assertStringIncludes(variantLogs.join('\n'), '@scope/gen-x (operation, variants) — 0 field(s)')

  // The base fixture's descriptor has supportsVariant:false → no suffix.
  const baseLogs = captureLogs(() => printDescribeResult(baseResult, { format: 'text' }))
  assertEquals(baseLogs.join('\n').includes(', variants'), false)
})

Deno.test('printDescribeResult - text prints a parse-issue line only when issues exist', () => {
  const clean = captureLogs(() => printDescribeResult(baseResult, { format: 'text' }))
  assertEquals(clean.join('\n').includes('parse issue'), false)

  const withIssues: DescribeResult = {
    ...baseResult,
    parseIssues: [
      {
        protocol: 'oas',
        level: 'warning',
        type: 'MISSING_OBJECT_TYPE',
        location: 'components:schemas:User',
        message: 'missing type'
      }
    ]
  }
  const logs = captureLogs(() => printDescribeResult(withIssues, { format: 'text' }))
  assertStringIncludes(logs.join('\n'), '(1 parse issue(s))')
})

Deno.test('printDescribeResult - json emits one object carrying all four sections', () => {
  const logs = captureLogs(() => printDescribeResult(baseResult, { format: 'json' }))
  assertEquals(logs.length, 1)
  const parsed: DescribeResult = JSON.parse(logs[0])
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(Object.keys(parsed.subjects), ['@scope/gen-x'])
  assertEquals(parsed.descriptors.length, 1)
  assertEquals(parsed.enrichmentDefaults['@scope/gen-x'], { User: { main: {} } })
  assertEquals(parsed.parseIssues, [])
})

Deno.test('renderDescribe - missing project arg fails with a recipe (exit 2)', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderDescribe({ projectName: undefined })
  })
  assertEquals(exitCode, 2)
  const joined = errors.join('\n')
  assertStringIncludes(joined, 'missing required argument: <project>')
  assertStringIncludes(joined, 'skmtc describe')
})

Deno.test('renderDescribe - unknown project fails with a recipe (exit 2)', async () => {
  const skmtcRoot = createMockSkmtcRoot(createMockManager(), { projects: [] })
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderDescribe({ projectName: 'nope', skmtcRoot })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors.join('\n'), 'missing required argument: <project>')
})

Deno.test('renderDescribe - existing project without a bundle exits 1 with a build hint', async () => {
  // The mock project's path has no bundle.js on disk, so describe hits
  // the precondition guard: a missing bundle is a build error (exit 1),
  // not a bad-argument recipe error (exit 2).
  const manager = createMockManager()
  const project = createMockProject(manager, { name: 'my-api' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [project] })

  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderDescribe({ projectName: 'my-api', skmtcRoot })
  })

  assertEquals(exitCode, 1)
  assertStringIncludes(errors.join('\n'), 'skmtc bundle my-api')
})

Deno.test('renderDescribe - bundle present but no schema source fails with a recipe (exit 2)', async () => {
  const tempDir = await Deno.makeTempDir()
  await Deno.writeTextFile(join(tempDir, 'bundle.js'), '')
  try {
    const manager = createMockManager()
    const project = createMockProject(manager, { name: 'my-api' })
    project.toPath = () => tempDir
    // settings only — no `source`, and no schemaSourceString override.
    project.clientJson.contents = { settings: mockClientJsonContents.settings }
    const skmtcRoot = createMockSkmtcRoot(manager, { projects: [project] })

    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderDescribe({ projectName: 'my-api', skmtcRoot })
    })

    assertEquals(exitCode, 2)
    const joined = errors.join('\n')
    assertStringIncludes(joined, 'missing required argument: [schema]')
    assertStringIncludes(joined, 'client.json#source')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('renderDescribe - happy path prints the result and exits 0', async () => {
  const tempDir = await Deno.makeTempDir()
  // An empty bundle.js satisfies the existence precondition; the mocked
  // Worker means it is never actually executed.
  await Deno.writeTextFile(join(tempDir, 'bundle.js'), '')
  const schemaPath = join(tempDir, 'openapi.json')
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({ openapi: '3.0.0', info: { title: 'E2E API', version: '1.0.0' }, paths: {} })
  )

  installSequencedWorker(resultMessage)

  const logs: string[] = []
  const originalLog = console.log
  console.log = (msg?: unknown) => logs.push(String(msg ?? ''))

  try {
    const manager = createMockManager()
    const project = createMockProject(manager, { name: 'my-api' })
    project.toPath = () => tempDir
    project.clientJson.contents = { settings: mockClientJsonContents.settings, source: schemaPath }
    const skmtcRoot = createMockSkmtcRoot(manager, { projects: [project] })

    const { exitCode } = await withCapturedExit(async () => {
      await renderDescribe({ projectName: 'my-api', skmtcRoot })
    })

    assertEquals(exitCode, 0)
    assertStringIncludes(logs.join('\n'), 'describe "my-api"')
  } finally {
    console.log = originalLog
    globalThis.Worker = OriginalWorker
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('renderDescribe - worker failure is caught and exits 1 with a rebundle hint', async () => {
  const tempDir = await Deno.makeTempDir()
  await Deno.writeTextFile(join(tempDir, 'bundle.js'), '')
  const schemaPath = join(tempDir, 'openapi.json')
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({ openapi: '3.0.0', info: { title: 'E2E API', version: '1.0.0' }, paths: {} })
  )

  // A core-version skew surfaces as a worker ERROR; renderDescribe must
  // turn that into a clean exit 1 with a rebundle hint, not an uncaught
  // rejection.
  installSequencedWorker({ type: 'ERROR', error: 'toSupportedSubjects is not a function' })

  try {
    const manager = createMockManager()
    const project = createMockProject(manager, { name: 'my-api' })
    project.toPath = () => tempDir
    project.clientJson.contents = { settings: mockClientJsonContents.settings, source: schemaPath }
    const skmtcRoot = createMockSkmtcRoot(manager, { projects: [project] })

    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderDescribe({ projectName: 'my-api', skmtcRoot })
    })

    assertEquals(exitCode, 1)
    const joined = errors.join('\n')
    assertStringIncludes(joined, 'describe failed for "my-api"')
    assertStringIncludes(joined, 'skmtc bundle my-api')
  } finally {
    globalThis.Worker = OriginalWorker
    await Deno.remove(tempDir, { recursive: true })
  }
})
