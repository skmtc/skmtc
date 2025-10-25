import React from 'react'
import { snapshotTest } from '@cliffy/testing'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toInstallCommand, renderInstall } from './install.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/lib/init.tsx'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'

// Create a stubbed version of renderInstall that prints parameters
const renderInstallStub = async ({
  projectName
}: {
  skmtcRoot: SkmtcRoot
  projectName: string
}) => {
  console.log('projectName:', projectName)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toInstallCommand(createMockSkmtcRoot(createMockManager()), renderInstallStub)
    await command.parse()
  }
})

Deno.test('renderInstall - should call toSession, render, and App with expected props', async () => {
  // Set up mocks
  const manager = createMockManager()

  const mockSession = toMockSession()
  // Spy on toSession
  const toSessionSpy = spy(() => Promise.resolve(mockSession))
  manager.auth.toSession = toSessionSpy

  const skmtcRoot = createMockSkmtcRoot(manager)

  // Test input values
  const testProjectName = 'test-project'

  // Mock render function that captures what it receives
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  // Mock App component - we don't need to spy on it being called
  // because we can inspect the React element directly
  const AppSpy = (_props: AppProps): React.JSX.Element => {
    // Return a valid React element
    return 'AppSpy' as unknown as React.JSX.Element
  }

  // Call renderInstall with our spies
  await renderInstall({
    skmtcRoot,
    projectName: testProjectName,
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
            page: 'install-generator',
            projectName: testProjectName
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
