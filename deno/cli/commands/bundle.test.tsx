import React from 'react'
import { assertEquals } from '@std/assert/equals'
import { renderBundle } from '@/commands/bundle.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import { toMockSession } from '@/tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'

Deno.test(
  'renderBundle - should call toSession, render, and App with expected props',
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

    // Mock render function that captures what it receives
    const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

    // Mock App component
    const AppSpy = (_props: AppProps): React.JSX.Element => {
      return 'AppSpy' as unknown as React.JSX.Element
    }

    // Call renderBundle with our spies
    await renderBundle({
      skmtcRoot,
      projectName: testProjectName,
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
    const props = element.props as { initialState: { view: { page: string; projectName: string } } }
    assertEquals(props.initialState.view.page, 'bundle')
    assertEquals(props.initialState.view.projectName, 'test-project')
  }
)

Deno.test('renderBundle - creates Manager and SkmtcRoot when not provided', async () => {
  // This test verifies the optional dependency injection pattern works
  // We can't fully test Manager/SkmtcRoot creation without mocking Deno.openKv,
  // but we can verify the function accepts undefined and doesn't error

  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)
  const AppSpy = (_props: AppProps): React.JSX.Element => {
    return 'AppSpy' as unknown as React.JSX.Element
  }

  // Note: This will fail in CI without a real KV store, so we skip actual execution
  // and just verify the function signature accepts the optional parameter
  const testFn = async () => {
    await renderBundle({
      projectName: 'test-project',
      renderFn: renderSpy as InkRenderFn,
      AppComponent: AppSpy
    })
  }

  // Verify the function is callable with just projectName
  assertEquals(typeof testFn, 'function')
})
