import { assertEquals } from '@std/assert/equals'
import { toLoginCommand } from '@/auth/auth.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'

Deno.test('login command - logs in successfully', async () => {
  const manager = createMockManager()
  let loginCalled = false

  manager.auth.login = async () => {
    loginCalled = true
    return { user: { id: 'test-user' }, access_token: 'test-token' } as any
  }

  const skmtcRoot = createMockSkmtcRoot(manager)
  skmtcRoot.login = async () => {
    await manager.auth.login()
  }

  const command = toLoginCommand(skmtcRoot)
  await command.parse([])

  assertEquals(loginCalled, true)
})

Deno.test('login command - handles login errors', async () => {
  const manager = createMockManager()
  manager.auth.login = async () => {
    throw new Error('Login failed')
  }

  const skmtcRoot = createMockSkmtcRoot(manager)
  skmtcRoot.login = async () => {
    await manager.auth.login()
  }

  const command = toLoginCommand(skmtcRoot)

  let errorThrown = false
  try {
    await command.parse([])
  } catch (error) {
    errorThrown = true
    assertEquals((error as Error).message, 'Login failed')
  }

  assertEquals(errorThrown, true)
})