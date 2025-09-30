import { assertEquals } from '@std/assert/equals'
import { toRuntimeLogsCommand } from '@/workspaces/runtime-logs.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('runtime-logs command - has correct description', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toRuntimeLogsCommand(skmtcRoot)

  assertEquals(command.getDescription(), 'View runtime logs')
})

Deno.test('runtime-logs command - accepts project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: []
  })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toRuntimeLogsCommand(skmtcRoot)

  const args = command.getArguments()
  assertEquals(args.length, 1)
  assertEquals(args[0].name, 'project')
})