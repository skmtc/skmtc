import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { generateSandboxApi, type GenerateSandboxApiArgs } from '@/services/generateSandboxApi.ts'
import type { ClientSettings } from '@/types/clientSettings.generated.ts'

// Store originals to restore after tests
const originalFetch = globalThis.fetch
const originalEnvGet = Deno.env.get
const originalConsoleLog = console.log

// Helper to create test arguments
const createTestArgs = (includeToken = true): GenerateSandboxApiArgs => ({
  accountName: 'test-account',
  serverName: 'test-server',
  schema: JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  }),
  clientSettings: {
    basePath: '/api',
    auth: { type: 'bearer' }
  } as ClientSettings,
  token: includeToken ? 'test-token-123' : undefined
})

// Mock valid CreateArtifactsResponse
const createMockResponse = () => ({
  artifacts: {
    'index.ts': 'export * from "./types"',
    'types.ts': 'export type User = { id: string }'
  },
  manifest: {
    deploymentId: 'test-deployment-123',
    traceId: 'trace-456',
    spanId: 'span-789',
    region: 'us-east-1',
    files: {
      'index.ts': {
        lines: 10,
        characters: 250,
        destinationPath: 'src/generated/index.ts'
      },
      'types.ts': {
        lines: 5,
        characters: 120,
        destinationPath: 'src/generated/types.ts'
      }
    },
    previews: {},
    mappings: {},
    results: {},
    startAt: Date.now() - 1000,
    endAt: Date.now()
  }
})

// Test 1: Success case with token
Deno.test('generateSandboxApi - returns artifacts with token', async () => {
  let fetchUrl: string | undefined
  let fetchOptions: RequestInit | undefined

  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    fetchUrl = url.toString()
    fetchOptions = options

    return new Response(JSON.stringify(createMockResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const args = createTestArgs(true)
    const result = await generateSandboxApi(args)

    // Verify result structure
    assertEquals(typeof result.artifacts, 'object')
    assertEquals(typeof result.manifest, 'object')
    assertEquals(result.artifacts['index.ts'], 'export * from "./types"')
    assertEquals(result.manifest.deploymentId, 'test-deployment-123')

    // Verify fetch parameters
    assertEquals(
      fetchUrl,
      'https://skmtc-sandbox.dmitrigrabov.deno.net/test-account/test-server/artifacts'
    )
    assertEquals(fetchOptions?.method, 'POST')

    // Verify headers include Authorization
    const headers = fetchOptions?.headers as Record<string, string>
    assertEquals(headers['Authorization'], 'Bearer test-token-123')
    assertEquals(headers['Content-Type'], 'application/json')

    // Verify body
    const body = JSON.parse(fetchOptions?.body as string)
    assertEquals(typeof body.schema, 'string')
    assertEquals(body.clientSettings.basePath, '/api')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 2: Success case without token
Deno.test('generateSandboxApi - returns artifacts without token', async () => {
  let fetchOptions: RequestInit | undefined

  globalThis.fetch = async (_url: string | URL | Request, options?: RequestInit) => {
    fetchOptions = options

    return new Response(JSON.stringify(createMockResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const args = createTestArgs(false) // No token
    const result = await generateSandboxApi(args)

    // Verify result is valid
    assertEquals(typeof result.artifacts, 'object')

    // Verify Authorization header is NOT included
    const headers = fetchOptions?.headers as Record<string, string>
    assertEquals(headers['Authorization'], undefined)
    assertEquals(headers['Content-Type'], 'application/json')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 3: HTTP error - throws and logs
Deno.test('generateSandboxApi - throws error on HTTP failure', async () => {
  let consoleLogCalled = false
  let loggedMessages: unknown[] = []

  console.log = (...args: unknown[]) => {
    consoleLogCalled = true
    loggedMessages = args
  }

  globalThis.fetch = async () => {
    return new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }

  try {
    const args = createTestArgs()

    await assertRejects(
      async () => {
        await generateSandboxApi(args)
      },
      Error,
      'Failed to generate artifacts'
    )

    // Verify console.log was called with error
    assertEquals(consoleLogCalled, true)
    assertEquals(loggedMessages[0], 'ERROR')
    assertEquals(loggedMessages[1], 'Internal Server Error')
  } finally {
    globalThis.fetch = originalFetch
    console.log = originalConsoleLog
  }
})

// Test 4: Network error - propagates
Deno.test('generateSandboxApi - propagates network error', async () => {
  globalThis.fetch = async () => {
    throw new Error('Network connection failed')
  }

  try {
    const args = createTestArgs()

    await assertRejects(
      async () => {
        await generateSandboxApi(args)
      },
      Error,
      'Network connection failed'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 5: Custom sandbox origin from environment
Deno.test('generateSandboxApi - uses custom SANDBOX_API_ORIGIN', async () => {
  let fetchUrl: string | undefined

  Deno.env.get = (key: string) => {
    if (key === 'SANDBOX_API_ORIGIN') {
      return 'https://custom-sandbox.example.com'
    }
    return originalEnvGet(key)
  }

  globalThis.fetch = async (url: string | URL | Request) => {
    fetchUrl = url.toString()
    return new Response(JSON.stringify(createMockResponse()), { status: 200 })
  }

  try {
    const args = createTestArgs()
    await generateSandboxApi(args)

    assertEquals(fetchUrl, 'https://custom-sandbox.example.com/test-account/test-server/artifacts')
  } finally {
    globalThis.fetch = originalFetch
    Deno.env.get = originalEnvGet
  }
})
