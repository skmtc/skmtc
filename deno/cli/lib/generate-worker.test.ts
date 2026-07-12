import { assertEquals, assertRejects } from '@std/assert'
import { generateWithWorker, description } from './generate-worker.ts'
import type { ManifestContent } from '@skmtc/core/Manifest'
import type { GeneratePayload } from '@skmtc/worker/types'

// Store original Worker constructor
const OriginalWorker = globalThis.Worker

// Mock Worker class for testing
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((error: ErrorEvent) => void) | null = null

  constructor(
    public url: string,
    public options?: WorkerOptions
  ) {}

  postMessage(_data: unknown) {
    // Mock postMessage
  }

  terminate() {
    // Mock terminate
  }

  // Helper to simulate worker sending a message
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }

  // Helper to simulate worker error
  simulateError(error: Error) {
    if (this.onerror) {
      const errorEvent = new ErrorEvent('error', {
        error,
        message: error.message
      })
      this.onerror(errorEvent)
    }
  }
}

// Helper to create mock schema contents
const createMockSchemaContents = () => {
  return JSON.stringify({
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0'
    },
    paths: {}
  })
}

// Helper to create mock client settings
const createMockClientSettings = () => {
  return {
    basePath: '/api',
    source: 'test-schema.yaml'
  }
}

// Helper to create mock manifest
const createMockManifest = (): ManifestContent => {
  return {
    deploymentId: 'test-deployment',
    traceId: 'test-trace',
    spanId: 'test-span',
    files: {},
    previews: {},
    results: {},
    parseIssues: [],
    startAt: Date.now(),
    endAt: Date.now()
  }
}

// Tests for description constant
Deno.test('description - has expected value', () => {
  assertEquals(
    description,
    'Web worker proof of concept - test generator execution in isolated worker'
  )
})

// Tests for generateWithWorker function
Deno.test('generateWithWorker - creates Worker with correct URL and permissions', async () => {
  let capturedWorker: MockWorker | null = null as MockWorker | null

  // Replace global Worker with mock
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)
      capturedWorker = instance

      // Simulate READY then RESULT to resolve the promise
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'RESULT',
            artifacts: {},
            manifest: createMockManifest()
          })
        }, 0)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: createMockClientSettings(),
      fileType: 'json' as const,
      bundlePath: './worker-bundle.ts'
    })

    // Verify Worker was created with correct URL
    assertEquals(capturedWorker?.url.includes('worker-bundle.ts'), true)

    // Verify Worker has correct options
    assertEquals(capturedWorker?.options?.type, 'module')

    // Verify permissions (need to cast to access the properties)
    const permissions = capturedWorker?.options?.deno?.permissions as {
      read?: boolean
      net?: boolean
      write?: boolean
      env?: boolean
      run?: boolean
    }
    assertEquals(permissions?.read, true)
    assertEquals(permissions?.net, false)
    assertEquals(permissions?.write, true)
    assertEquals(permissions?.env, true)
    assertEquals(permissions?.run, false)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - handles READY message and posts GENERATE message', async () => {
  const postedMessages: unknown[] = []

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Override postMessage to capture messages
      instance.postMessage = (data: unknown) => {
        postedMessages.push(data)
      }

      // Simulate READY then RESULT
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'RESULT',
            artifacts: {},
            manifest: createMockManifest()
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: createMockClientSettings(),
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    // Verify GENERATE message was posted
    assertEquals(postedMessages.length >= 1, true)
    const generateMessage = postedMessages[0] as { type: string; payload: unknown }
    assertEquals(generateMessage.type, 'GENERATE')
    assertEquals(typeof generateMessage.payload, 'object')
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - resolves with artifacts and manifest on RESULT message', async () => {
  const mockArtifacts = {
    'file1.ts': 'content1',
    'file2.ts': 'content2'
  }
  const mockManifest = createMockManifest()

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Simulate READY then RESULT with data
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'RESULT',
            artifacts: mockArtifacts,
            manifest: mockManifest
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    const result = await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: createMockClientSettings(),
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    assertEquals(result.artifacts, mockArtifacts)
    assertEquals(result.manifest, mockManifest)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - rejects on ERROR message from worker', async () => {
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Simulate READY then ERROR
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'ERROR',
            error: 'Test error message'
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await assertRejects(async () => {
      await generateWithWorker({
        schemaContents: createMockSchemaContents(),
        clientSettings: createMockClientSettings(),
        fileType: 'json' as const,
        bundlePath: './worker.ts'
      })
    }, Error)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - rejects on worker.onerror', async () => {
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Simulate worker error
      setTimeout(() => {
        instance.simulateError(new Error('Worker crashed'))
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await assertRejects(async () => {
      await generateWithWorker({
        schemaContents: createMockSchemaContents(),
        clientSettings: createMockClientSettings(),
        fileType: 'json' as const,
        bundlePath: './worker.ts'
      })
    })
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - terminates worker after successful completion', async () => {
  let terminateCalled = false

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Override terminate to track calls
      instance.terminate = () => {
        terminateCalled = true
      }

      // Simulate READY then RESULT
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'RESULT',
            artifacts: {},
            manifest: createMockManifest()
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: createMockClientSettings(),
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    assertEquals(terminateCalled, true)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - terminates worker after error', async () => {
  let terminateCalled = false

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      // Override terminate to track calls
      instance.terminate = () => {
        terminateCalled = true
      }

      // Simulate READY then ERROR
      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'ERROR',
            error: 'Test error'
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await assertRejects(async () => {
      await generateWithWorker({
        schemaContents: createMockSchemaContents(),
        clientSettings: createMockClientSettings(),
        fileType: 'json' as const,
        bundlePath: './worker.ts'
      })
    })

    assertEquals(terminateCalled, true)
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - handles undefined clientSettings', async () => {
  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      setTimeout(() => {
        instance.simulateMessage({ type: 'READY' })
        setTimeout(() => {
          instance.simulateMessage({
            type: 'RESULT',
            artifacts: {},
            manifest: createMockManifest()
          })
        }, 10)
      }, 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    const result = await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: undefined,
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    assertEquals(typeof result.artifacts, 'object')
    assertEquals(typeof result.manifest, 'object')
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - posts GraphQL payload (protocol=gql, gqlSource) for graphql fileType', async () => {
  let capturedPayload: unknown = null

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      instance.postMessage = (data: unknown) => {
        const message = data as { type: string; payload: unknown }
        if (message.type === 'GENERATE') {
          capturedPayload = message.payload
          setTimeout(() => {
            instance.simulateMessage({
              type: 'RESULT',
              artifacts: {},
              manifest: createMockManifest()
            })
          }, 0)
        }
      }

      setTimeout(() => instance.simulateMessage({ type: 'READY' }), 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await generateWithWorker({
      schemaContents: 'type Query { ping: Boolean }',
      clientSettings: undefined,
      fileType: 'graphql' as const,
      bundlePath: './worker.ts'
    })

    const payload = capturedPayload as GeneratePayload
    // The wire shape uses a `document` discriminated union now —
    // `{ type: 'gql', value: <sdl> }` instead of the old
    // `protocol: 'gql', gqlSource: <sdl>` flat shape.
    assertEquals(payload.document.type, 'gql')
    if (payload.document.type === 'gql') {
      assertEquals(payload.document.value, 'type Query { ping: Boolean }')
    }
  } finally {
    globalThis.Worker = OriginalWorker
  }
})

Deno.test('generateWithWorker - posts OAS payload (protocol=oas, documentObject) for json fileType', async () => {
  let capturedPayload: unknown = null

  globalThis.Worker = class {
    constructor(url: string | URL, options?: WorkerOptions) {
      const instance = new MockWorker(url.toString(), options)

      instance.postMessage = (data: unknown) => {
        const message = data as { type: string; payload: unknown }
        if (message.type === 'GENERATE') {
          capturedPayload = message.payload
          setTimeout(() => {
            instance.simulateMessage({
              type: 'RESULT',
              artifacts: {},
              manifest: createMockManifest()
            })
          }, 0)
        }
      }

      setTimeout(() => instance.simulateMessage({ type: 'READY' }), 0)

      return instance as unknown as Worker
    }
  } as unknown as typeof Worker

  try {
    await generateWithWorker({
      schemaContents: createMockSchemaContents(),
      clientSettings: undefined,
      fileType: 'json' as const,
      bundlePath: './worker.ts'
    })

    const payload = capturedPayload as GeneratePayload
    // OAS now travels as `{ type: 'oas', value: <OpenAPIV3.Document> }`.
    assertEquals(payload.document.type, 'oas')
    if (payload.document.type === 'oas') {
      assertEquals(payload.document.value.openapi, '3.0.0')
    }
  } finally {
    globalThis.Worker = OriginalWorker
  }
})
