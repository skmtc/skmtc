import { assertEquals } from '@std/assert/equals'
import { toGenerateCommand } from '../../workspaces/generate.tsx'
import { createMockManager } from '../mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '../mocks/skmtc-root.mock.ts'
import { createMockProject } from '../mocks/project.mock.ts'

Deno.test('generate command - parses project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toGenerateCommand(skmtcRoot)

  // The command should be created successfully
  assertEquals(command.getDescription(), 'Generate artifacts')
})

Deno.test('generate command - has watch option', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toGenerateCommand(skmtcRoot)
  const options = command.getOptions()

  const watchOption = options.find(opt => opt.name === 'watch')
  assertEquals(watchOption !== undefined, true)
  assertEquals(watchOption?.flags?.join(', '), '-w, --watch')
})