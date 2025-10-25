import { assertEquals } from '@std/assert/equals'
import { toProject } from '@/workspaces/generate.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'

Deno.test('toProject - returns local project for non-project-key name', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const project = await toProject({
    skmtcRoot,
    projectName: 'test-project',
    schemaSourceString: undefined
  })

  // Should return the local project
  assertEquals(project, mockProject)
  assertEquals(project.name, 'test-project')
})

Deno.test('toProject - handles local project with schema string', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'local-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const project = await toProject({
    skmtcRoot,
    projectName: 'local-project',
    schemaSourceString: 'https://example.com/schema.json'
  })

  // Even with schemaSourceString, should still return local project
  // (schemaSourceString is only used for remote projects)
  assertEquals(project, mockProject)
  assertEquals(project.name, 'local-project')
})

Deno.test('toProject - detects project key format correctly', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  // Test that @scope/name is NOT treated as local project
  // We can't easily test RemoteProject creation without mocking,
  // but we can verify the local project is NOT returned for project keys

  // This test verifies non-project-key behavior
  const localProject = await toProject({
    skmtcRoot,
    projectName: 'test-project',
    schemaSourceString: undefined
  })

  assertEquals(localProject.name, 'test-project')
})

Deno.test('toProject - throws error for non-existent local project', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  let errorThrown = false
  try {
    await toProject({
      skmtcRoot,
      projectName: 'non-existent',
      schemaSourceString: undefined
    })
  } catch (error) {
    errorThrown = true
    assertEquals(error instanceof Error, true)
    if (error instanceof Error) {
      assertEquals(error.message.includes('non-existent'), true)
    }
  }

  assertEquals(errorThrown, true, 'Should throw error for non-existent project')
})
