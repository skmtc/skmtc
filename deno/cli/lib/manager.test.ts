import { assertEquals } from '@std/assert/equals'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { Manager } from '@/lib/manager.ts'

Deno.test('Manager - cleanup executes all registered cleanup actions', async () => {
  const manager = createMockManager()
  // Replace stubbed cleanup with real implementation from Manager class
  manager.cleanup = Manager.prototype.cleanup.bind(manager)
  const executionOrder: number[] = []

  manager.cleanupActions.push(async () => {
    executionOrder.push(1)
  })
  manager.cleanupActions.push(async () => {
    executionOrder.push(2)
  })
  manager.cleanupActions.push(async () => {
    executionOrder.push(3)
  })

  await manager.cleanup()

  assertEquals(executionOrder.length, 3)
  assertEquals(executionOrder.includes(1), true)
  assertEquals(executionOrder.includes(2), true)
  assertEquals(executionOrder.includes(3), true)
})
Deno.test('Manager - cleanup executes actions in parallel', async () => {
  const manager = createMockManager()
  manager.cleanup = Manager.prototype.cleanup.bind(manager)
  let action1Started = false
  let action2Started = false
  let action1Completed = false
  let action2Completed = false

  manager.cleanupActions.push(async () => {
    action1Started = true
    await new Promise(resolve => setTimeout(resolve, 50))
    action1Completed = true
  })

  manager.cleanupActions.push(async () => {
    action2Started = true
    // Check if action1 has completed - it shouldn't have yet if running in parallel
    assertEquals(action1Completed, false)
    await new Promise(resolve => setTimeout(resolve, 10))
    action2Completed = true
  })

  await manager.cleanup()

  assertEquals(action1Started, true)
  assertEquals(action2Started, true)
  assertEquals(action1Completed, true)
  assertEquals(action2Completed, true)
})

Deno.test('Manager - cleanup handles empty cleanup actions', async () => {
  const manager = createMockManager()

  // Should not throw
  await manager.cleanup()

  assertEquals(manager.cleanupActions.length, 0)
})

Deno.test('Manager - cleanup continues even if one action fails', async () => {
  const manager = createMockManager()
  manager.cleanup = Manager.prototype.cleanup.bind(manager)
  const executedActions: string[] = []

  manager.cleanupActions.push(async () => {
    executedActions.push('action1')
  })

  manager.cleanupActions.push(async () => {
    throw new Error('Action 2 failed')
  })

  manager.cleanupActions.push(async () => {
    executedActions.push('action3')
  })

  try {
    await manager.cleanup()
  } catch {
    // Expected to fail due to one action throwing
  }

  // Both successful actions should have executed
  assertEquals(executedActions.includes('action1'), true)
  assertEquals(executedActions.includes('action3'), true)
})

Deno.test('Manager - multiple cleanup calls execute actions each time', async () => {
  const manager = createMockManager()
  manager.cleanup = Manager.prototype.cleanup.bind(manager)
  let executionCount = 0

  manager.cleanupActions.push(async () => {
    executionCount++
  })

  await manager.cleanup()
  assertEquals(executionCount, 1)

  await manager.cleanup()
  assertEquals(executionCount, 2)
})
