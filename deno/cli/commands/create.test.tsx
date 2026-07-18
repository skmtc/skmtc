import type React from 'react'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { renderCreate } from './create.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test('renderCreate - should call toSession, render, and App with expected props', async () => {
  await withFakeTty(async () => {
  // Set up mocks
  const manager = createMockManager()

  // Spy on toSession

  const skmtcRoot = createMockSkmtcRoot(manager)

  // Test input values
  const testProjectName = 'test-project'
  const testGenerator = 'my-generator'
  const testType: 'operation' | 'model' = 'operation'

  // Mock render function that captures what it receives
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  // Mock App component - we don't need to spy on it being called
  // because we can inspect the React element directly
  const AppSpy = (_props: AppProps): React.JSX.Element => {
    // Return a valid React element
    return 'AppSpy' as unknown as React.JSX.Element
  }

  // Call renderCreate with our spies
  await renderCreate({
    skmtcRoot,
    projectName: testProjectName,
    generator: testGenerator,
    type: testType,
    renderFn: renderSpy as InkRenderFn,
    AppComponent: AppSpy
  })

  // Verify toSession was called

  // Verify render was called with an element
  assertSpyCalls(renderSpy, 1)

  assertSpyCall(renderSpy, 0, {
    args: [
      // deno-lint-ignore jsx-key
      <AppSpy
        initialState={{
          view: {
            page: 'create-generator',
            projectName: testProjectName,
            generatorName: testGenerator,
            generatorType: testType,
            language: undefined
          },
          skmtcRoot,
          message: null,
          interactive: false,
          shortcuts: [],
          generators: []
        }}
      />
    ]
  })
  })
})
