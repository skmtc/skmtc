import { assertEquals } from '@std/assert/equals'
import { toListCommand } from '@/generators/list.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('list command - lists generators for project', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod', '@skmtc/gen-msw']
  })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toListCommand(skmtcRoot)

  // Capture console.log output
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '))
  }

  try {
    await command.parse(['test-project'])

    assertEquals(logs.length, 3)
    assertEquals(logs, [
      '@skmtc/gen-typescript',
      '@skmtc/gen-zod',
      '@skmtc/gen-msw'
    ])
  } finally {
    console.log = originalLog
  }
})

Deno.test('list command - handles project with no generators', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'empty-project',
    generators: []
  })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toListCommand(skmtcRoot)

  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '))
  }

  try {
    await command.parse(['empty-project'])

    assertEquals(logs.length, 0)
  } finally {
    console.log = originalLog
  }
})

Deno.test('list command - handles non-existent project gracefully', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toListCommand(skmtcRoot)

  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '))
  }

  try {
    await command.parse(['non-existent-project'])
    // Should not log anything or throw when project not found
    assertEquals(logs, [])
  } finally {
    console.log = originalLog
  }
})