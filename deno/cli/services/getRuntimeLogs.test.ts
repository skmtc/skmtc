import { assertEquals } from '@std/assert/equals'
import { getRuntimeLogs, type GetRuntimeLogsArgs } from '@/services/getRuntimeLogs.ts'

// Store originals to restore after tests
const originalFetch = globalThis.fetch
const originalEnvGet = Deno.env.get
const originalConsoleLog = console.log

// Helper to create test arguments
const createTestArgs = (): GetRuntimeLogsArgs => ({
  accountName: 'test-account',
  serverName: 'test-server',
  spanId: 'span-123-456',
  token: 'test-token-abc'
})

// Mock log entries (matching AppLogsResponseEntry structure)
const createMockLogs = () => [
  {
    time: '2024-01-15T10:30:00.000Z',
    level: 'info',
    message: 'Server started successfully',
    region: 'us-east1'
  },
  {
    time: '2024-01-15T10:30:05.123Z',
    level: 'error',
    message: 'Database connection failed',
    region: 'us-east1'
  },
  {
    time: '2024-01-15T10:30:10.456Z',
    level: 'warning',
    message: 'High memory usage detected',
    region: 'us-east1'
  }
]

// Test 1: Success case with logs
Deno.test('getRuntimeLogs - returns log entries on success', async () => {
  let fetchUrl: string | undefined
  let fetchOptions: RequestInit | undefined

  const mockLogs = createMockLogs()

  globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    fetchUrl = url.toString()
    fetchOptions = options

    return new Response(JSON.stringify(mockLogs), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const args = createTestArgs()
    const result = await getRuntimeLogs(args)

    // Verify result is the log array
    assertEquals(Array.isArray(result), true)
    assertEquals(result?.length, 3)
    assertEquals(result?.[0].level, 'info')
    assertEquals(result?.[0].message, 'Server started successfully')
    assertEquals(result?.[1].level, 'error')
    assertEquals(result?.[2].level, 'warning')

    // Verify fetch parameters
    assertEquals(
      fetchUrl,
      'https://skmtc-sandbox.dmitrigrabov.deno.net/test-account/test-server/span-123-456/logs'
    )
    assertEquals(fetchOptions?.method, 'GET')

    // Verify Authorization header
    const headers = fetchOptions?.headers as Record<string, string>
    assertEquals(headers['Authorization'], 'Bearer test-token-abc')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 2: Success case with empty logs
Deno.test('getRuntimeLogs - returns empty array when no logs', async () => {
  globalThis.fetch = async () => {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const args = createTestArgs()
    const result = await getRuntimeLogs(args)

    // Verify result is empty array (not null)
    assertEquals(Array.isArray(result), true)
    assertEquals(result?.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 3: HTTP error - returns null and logs error
Deno.test('getRuntimeLogs - returns null on HTTP error', async () => {
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
    const result = await getRuntimeLogs(args)

    // Verify result is null (not throwing)
    assertEquals(result, null)

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
Deno.test('getRuntimeLogs - propagates network error', async () => {
  globalThis.fetch = async () => {
    throw new Error('Network connection failed')
  }

  try {
    const args = createTestArgs()

    // Function doesn't catch the error, so it propagates
    let errorThrown = false
    try {
      await getRuntimeLogs(args)
    } catch (error) {
      errorThrown = true
      assertEquals((error as Error).message, 'Network connection failed')
    }

    assertEquals(errorThrown, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Test 5: Custom sandbox origin from environment
Deno.test('getRuntimeLogs - uses custom SANDBOX_API_ORIGIN', async () => {
  let fetchUrl: string | undefined

  Deno.env.get = (key: string) => {
    if (key === 'SANDBOX_API_ORIGIN') {
      return 'https://custom-sandbox.example.com'
    }
    return originalEnvGet(key)
  }

  globalThis.fetch = async (url: string | URL | Request) => {
    fetchUrl = url.toString()
    return new Response(JSON.stringify([]), { status: 200 })
  }

  try {
    const args = createTestArgs()
    await getRuntimeLogs(args)

    assertEquals(
      fetchUrl,
      'https://custom-sandbox.example.com/test-account/test-server/span-123-456/logs'
    )
  } finally {
    globalThis.fetch = originalFetch
    Deno.env.get = originalEnvGet
  }
})
