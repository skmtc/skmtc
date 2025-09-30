import { assertEquals } from '@std/assert/equals'
import { toServeCommand } from '../../workspaces/serve.ts'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('serve command - has correct description', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toServeCommand(skmtcRoot)

  assertEquals(command.getDescription(), 'Run project server locally')
})

Deno.test('serve command - accepts project name and optional port', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: []
  })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toServeCommand(skmtcRoot)

  const args = command.getArguments()
  assertEquals(args.length, 2)
  assertEquals(args[0].name, 'project')
  assertEquals(args[1].name, 'port')
})