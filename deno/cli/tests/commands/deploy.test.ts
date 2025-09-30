import { assertEquals } from '@std/assert/equals'
import { toDeployCommand } from '../../generators/deploy.tsx'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('deploy command - accepts project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, {
    name: 'test-project',
    generators: []
  })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toDeployCommand(skmtcRoot)

  // The command should be created successfully with project argument
  assertEquals(command.getDescription(), 'Deploy generators')

  const args = command.getArguments()
  assertEquals(args.length, 1)
  assertEquals(args[0].name, 'project')
})

Deno.test('deploy command - has correct description', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toDeployCommand(skmtcRoot)

  assertEquals(command.getDescription(), 'Deploy generators')
})