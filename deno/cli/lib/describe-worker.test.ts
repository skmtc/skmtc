import { assertEquals, assertRejects } from '@std/assert'
import { describeWithWorker } from './describe-worker.ts'
import type { DescribePayload } from '@skmtc/worker/types'

// Store original Worker constructor
const OriginalWorker = globalThis.Worker

// Mock Worker class for testing — mirrors generate-worker.test.ts.
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

  simulateError(error: Error) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { error, message: error.message }))
    }
  }
}

const createMockSchemaContents = () =>
  JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  })

// A representative DESCRIBE RESULT payload (the three engine outputs).
// Discriminant literals are `as const` so the shapes satisfy the
// strongly-typed `DescribeResponse` fields the resolved promise carries.
const createMockDescribeResult = () => ({
  type: 'RESULT',
  subjects: { '@scope/gen-x': { type: 'model' as const, models: ['User'] } },
  descriptors: [
    {
      generator: '@scope/gen-x',
      subjectType: 'model' as const,
      supportsVariant: false,
      fields: []
    }
  ],
  enrichmentDefaults: { '@scope/gen-x': { User: { main: {} } } },
  parseIssues: []
})

Deno.test('describeWithWorker - creates Worker read-only (write: false)', async () => {
  let capturedWorker: MockWorker | null = null as MockWorker | null

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      capturedWorker = instance
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => instance.simulateMessage(createMockDescribeResult()), 0)
      }, 0)
      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await describeWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: undefined,
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    assertEquals(capturedWorker?.options?.type, 'module')
    const permissions = capturedWorker?.options?.deno?.permissions as {
      read?: boolean
      net?: boolean
      write?: boolean
      env?: boolean
      run?: boolean
    }
    assertEquals(permissions?.read, true)
    assertEquals(permissions?.net, false)
    // describe is read-only — no artifacts are written.
    assertEquals(permissions?.write, false)
    assertEquals(permissions?.run, false)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('describeWithWorker - handles READY and posts a DESCRIBE message (OAS document)', async () => {
  let capturedPayload: unknown = null

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      instance.postMessage = (data: unknown) => {
        const message = data as { type: string; payload: unknown }
        if (message.type === 'DESCRIBE') {
          capturedPayload = message.payload
          setTimeout(() => instance.simulateMessage(createMockDescribeResult()), 0)
        }
      }
      setTimeout(() => instance.simulateMessage({ type: 'READY' }), 0)
      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await describeWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: undefined,
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    const payload = capturedPayload as DescribePayload
    assertEquals(payload.document.type, 'oas')
    if (payload.document.type === 'oas') {
      assertEquals(payload.document.value.openapi, '3.0.0')
    }
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('describeWithWorker - resolves with subjects/descriptors/defaults on RESULT', async () => {
  const expected = createMockDescribeResult()

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => instance.simulateMessage(expected), 0)
      }, 0)
      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    const result = await describeWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: undefined,
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    assertEquals(result.subjects, expected.subjects)
    assertEquals(result.descriptors, expected.descriptors)
    assertEquals(result.enrichmentDefaults, expected.enrichmentDefaults)
    assertEquals(result.parseIssues, expected.parseIssues)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('describeWithWorker - rejects on ERROR message', async () => {
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => instance.simulateMessage({ type: 'ERROR', error: 'boom' }), 0)
      }, 0)
      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await assertRejects(
      () =>
        describeWithWorker({
          schemaContents: createMockSchemaContents(),
          clientSettings: undefined,
          fileType: 'json' as const,
          bundlePath: './worker.ts'
        }),
      Error
    )
  } finally {
    globalThis.Worker = OriginalWorker
  }
})
