import React from 'react'
import { assertEquals } from '@std/assert/equals'
import { renderGenerate } from '@/commands/generate.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'

Deno.test('renderGenerate - should call render and App with expected props', async () => {
  // Set up mocks
  const manager = createMockManager()

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
})
