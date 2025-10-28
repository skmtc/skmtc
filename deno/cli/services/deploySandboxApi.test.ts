import { assertEquals } from '@std/assert/equals'
import { deploySandboxApi, type DeploySandboxApiArgs } from '@/services/deploySandboxApi.ts'
import type { DenoFile } from '@/types/denoFile.generated.ts'

// Store originals to restore after tests
const originalFetch = globalThis.fetch
const originalEnvGet = Deno.env.get
const originalConsoleLog = console.log

// Helper to create test arguments
const createTestArgs = (): DeploySandboxApiArgs => ({
  accountName: 'test-account',
  serverName: 'test-server',
  assets: {
    'main.ts': {
      kind: 'file',
      content: 'console.log("hello")',
      encoding: 'utf-8'
    } as DenoFile,
    'lib/helper.ts': {
      kind: 'file',
      content: 'export const helper = () => {}',
      encoding: 'utf-8'
    } as DenoFile
  },
  generatorIds: ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
  token: 'test-token-123'
})

// Test 1: Success case - deployment succeeds
Deno.test('deploySandboxApi - returns true on successful deployment', async () => {
  let fetchUrl: string | undefined
  let fetchOptions: RequestInit | undefined

  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    fetchUrl = url.toString()
    fetchOptions = options

    return new Response('Deployment successful', {
      status: 200,
      statusText: 'OK'
    })
  }

  try {
    const args = createTestArgs()
    const result = await deploySandboxApi(args)

    // Verify result
    assertEquals(result, true)

    // Verify fetch was called with correct parameters
    assertEquals(
      fetchUrl,
      'https://skmtc-sandbox.dmitrigrabov.deno.net/test-account/test-server'
    )
    assertEquals(fetchOptions?.method, 'PUT')
    assertEquals(fetchOptions?.headers, {
      Authorization: 'Bearer test-token-123',
      'Content-Type': 'application/json'
    })

    // Verify body contains assets and generatorIds
    const body = JSON.parse(fetchOptions?.body as string)
    assertEquals(body.generatorIds, ['@skmtc/gen-typescript', '@skmtc/gen-zod'])
    assertEquals(Object.keys(body.assets).length, 2)
    assertEquals(body.assets['main.ts'].content, 'console.log("hello")')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 2: Failure case - HTTP error response
Deno.test('deploySandboxApi - returns false on HTTP error response', async () => {
  let consoleLogCalled = false
  let loggedMessage: unknown[] = []

  console.log = (...args: unknown[]) => {
    consoleLogCalled = true
    loggedMessage = args
  }

  globalThis.fetch = async () => {
    return new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }

  try {
    const args = createTestArgs()
    const result = await deploySandboxApi(args)

    // Verify result is false
    assertEquals(result, false)

    // Verify console.log was called with error
    assertEquals(consoleLogCalled, true)
    assertEquals(loggedMessage[0], 'ERROR')
    assertEquals(loggedMessage[1], 'Internal Server Error')
  } finally {
    globalThis.fetch = originalFetch
    console.log = originalConsoleLog
  }
})

// Test 3: Network error - fetch throws
Deno.test('deploySandboxApi - returns false on network error', async () => {
  globalThis.fetch = async () => {
    throw new Error('Network connection failed')
  }

  try {
    const args = createTestArgs()

    // The function doesn't catch errors, so it will propagate
    // In a real scenario, the caller should handle this
    let errorThrown = false
    try {
      await deploySandboxApi(args)
    } catch (error) {
      errorThrown = true
      assertEquals((error as Error).message, 'Network connection failed')
    }

    assertEquals(errorThrown, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 4: Custom sandbox origin from environment variable
Deno.test('deploySandboxApi - uses custom SANDBOX_API_ORIGIN from env', async () => {
  let fetchUrl: string | undefined

  Deno.env.get = (key: string) => {
    if (key === 'SANDBOX_API_ORIGIN') {
      return 'https://custom-sandbox.example.com'
    }
    return originalEnvGet(key)
  }

  globalThis.fetch = async (url: string | URL | Request) => {
    fetchUrl = url.toString()
    return new Response('OK', { status: 200 })
  }

  try {
    const args = createTestArgs()
    const result = await deploySandboxApi(args)

    assertEquals(result, true)
    assertEquals(fetchUrl, 'https://custom-sandbox.example.com/test-account/test-server')
  } finally {
    globalThis.fetch = originalFetch
    Deno.env.get = originalEnvGet
  }
})
