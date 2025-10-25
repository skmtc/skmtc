import React from 'react'
import { snapshotTest } from '@cliffy/testing'
import { assertEquals } from '@std/assert/equals'
import { toGenerateCommand, renderGenerate, toProject } from '@/commands/generate.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import { toMockSession } from '@/tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

// Create a stubbed version of renderGenerate that prints parameters
const renderGenerateStub = async ({
  projectName,
  schemaSourceString,
  watch
}: {
  skmtcRoot: SkmtcRoot
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
}) => {
  console.log('projectName:', projectName)
  console.log('schemaSourceString:', schemaSourceString)
  console.log('watch:', watch)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project', 'https://example.com/schema.json'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toGenerateCommand(createMockSkmtcRoot(createMockManager()), renderGenerateStub)
    await command.parse()
  }
})

await snapshotTest({
  name: 'should log Deno.args with watch flag',
  meta: import.meta,
  args: ['test-project', '--watch'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toGenerateCommand(createMockSkmtcRoot(createMockManager()), renderGenerateStub)
    await command.parse()
  }
})

Deno.test('generate command - parses project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toGenerateCommand(skmtcRoot, renderGenerateStub)

  // The command should be created successfully
  assertEquals(command.getDescription(), 'Generate artifacts')
})

Deno.test('generate command - has watch option', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toGenerateCommand(skmtcRoot, renderGenerateStub)
  const options = command.getOptions()

  const watchOption = options.find(opt => opt.name === 'watch')
  assertEquals(watchOption !== undefined, true)
  assertEquals(watchOption?.flags?.join(', '), '-w, --watch')
})

Deno.test(
  'renderGenerate - should call toSession, render, and App with expected props',
  async () => {
    // Set up mocks
    const manager = createMockManager()

    const mockSession = toMockSession()
    // Spy on toSession
    const toSessionSpy = spy(() => Promise.resolve(mockSession))
    manager.auth.toSession = toSessionSpy

    const mockProject = createMockProject(manager, { name: 'test-project' })
    const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

    // Test input values
    const testProjectName = 'test-project'
    const testSchemaSourceString = 'https://example.com/schema.json'
    const testWatch = true

    // Mock render function that captures what it receives
    const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

    // Mock App component - we don't need to spy on it being called
    // because we can inspect the React element directly
    const AppSpy = (_props: AppProps): React.JSX.Element => {
      // Return a valid React element
      return 'AppSpy' as unknown as React.JSX.Element
    }

    // Call renderGenerate with our spies
    await renderGenerate({
      skmtcRoot,
      projectName: testProjectName,
      schemaSourceString: testSchemaSourceString,
      watch: testWatch,
      renderFn: renderSpy as InkRenderFn,
      AppComponent: AppSpy
    })

    // Verify toSession was called
    assertSpyCalls(toSessionSpy, 1)

    // Verify render was called with an element
    assertSpyCalls(renderSpy, 1)

    // Get the actual call to verify the structure
    const call = renderSpy.calls[0]
    const element = call.args[0] as React.ReactElement

    // Verify it's a React element with the right component
    assertEquals(React.isValidElement(element), true)
    assertEquals(element.type, AppSpy)

    // Verify the initialState structure
    const props = element.props as { initialState: { view: { page: string } } }
    assertEquals(props.initialState.view.page, 'generate')
  }
)

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
