import React from 'react'
import { snapshotTest } from '@cliffy/testing'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toCreateCommand, renderCreate } from './create.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/lib/init.tsx'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'

// Create a stubbed version of renderCreate that prints parameters
const renderCreateStub = async ({
  projectName,
  generator,
  type
}: {
  skmtcRoot: SkmtcRoot
  projectName: string
  generator: string
  type: 'operation' | 'model'
}) => {
  console.log('projectName:', projectName)
  console.log('generator:', generator)
  console.log('type:', type)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project', 'my-generator', 'operation'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toCreateCommand(createMockSkmtcRoot(createMockManager()), renderCreateStub)
    await command.parse()
  }
})

Deno.test('renderCreate - should call toSession, render, and App with expected props', async () => {
  // Set up mocks
  const manager = createMockManager()

  const mockSession = toMockSession()
  // Spy on toSession
  const toSessionSpy = spy(() => Promise.resolve(mockSession))
  manager.auth.toSession = toSessionSpy

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
  assertSpyCalls(toSessionSpy, 1)

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
            generatorType: testType
          },
          skmtcRoot,
          session: mockSession,
          message: null,
          interactive: false,
          shortcuts: [],
          generators: []
        }}
      />
    ]
  })
})
