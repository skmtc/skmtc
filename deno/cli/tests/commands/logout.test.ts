import { assertEquals } from '@std/assert/equals'
import { toLogoutCommand } from '@/auth/auth.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'

Deno.test('logout command - logs out successfully', async () => {
  const manager = createMockManager()
  let logoutCalled = false
  let logoutSilent = false

  manager.auth.logout = async ({ silent }) => {
    logoutCalled = true
    logoutSilent = silent
  }

  const skmtcRoot = createMockSkmtcRoot(manager)
  skmtcRoot.logout = async ({ silent }) => {
    await manager.auth.logout({ silent })
  }

  const command = toLogoutCommand(skmtcRoot)
  await command.parse([])

  assertEquals(logoutCalled, true)
  assertEquals(logoutSilent, false)
})

Deno.test('logout command - handles logout errors', async () => {
  const manager = createMockManager()
  manager.auth.logout = async () => {
    throw new Error('Logout failed')
  }

  const skmtcRoot = createMockSkmtcRoot(manager)
  skmtcRoot.logout = async ({ silent }) => {
    await manager.auth.logout({ silent })
  }

  const command = toLogoutCommand(skmtcRoot)

  let errorThrown = false
  try {
    await command.parse([])
  } catch (error) {
    errorThrown = true
    assertEquals((error as Error).message, 'Logout failed')
  }

  assertEquals(errorThrown, true)
})