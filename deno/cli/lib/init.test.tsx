import React from 'react'
import { snapshotTest } from '@cliffy/testing'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toInitCommand, renderInit } from './init.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from './init.tsx'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'

// Create a stubbed version of renderInit that prints parameters
const renderInitStub = async ({
  projectName,
  generators,
  basePath
}: {
  skmtcRoot: SkmtcRoot
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
}) => {
  console.log('projectName:', projectName)
  console.log('generators:', generators)
  console.log('basePath:', basePath)

  return await Promise.resolve()
}

await snapshotTest({
  name: 'should log Deno.args',
  meta: import.meta,
  args: ['test-project', '@skmtc/gen-typescript', './lib'],
  denoArgs: ['--allow-all'],
  async fn() {
    const command = toInitCommand(createMockSkmtcRoot(createMockManager()), renderInitStub)
    await command.parse()
  }
})

Deno.test('renderInit - should call toSession, render, and App with expected props', async () => {
  // Set up mocks
  const manager = createMockManager()

  const mockSession = toMockSession()
  // Spy on toSession
  const toSessionSpy = spy(() => Promise.resolve(mockSession))
  manager.auth.toSession = toSessionSpy

  const skmtcRoot = createMockSkmtcRoot(manager)

  // Test input values
  const testProjectName = 'test-project'
  const testGenerators = ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  const testBasePath = './src'

  // Mock render function that captures what it receives
  const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

  // Mock App component - we don't need to spy on it being called
  // because we can inspect the React element directly
  const AppSpy = (_props: AppProps): React.JSX.Element => {
    // Return a valid React element

    return 'AppSpy' as unknown as React.JSX.Element
  }

  // Call renderInit with our spies
  await renderInit({
    skmtcRoot,
    projectName: testProjectName,
    generators: testGenerators,
    basePath: testBasePath,
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
            page: 'create-project',
            projectName: testProjectName,
            generators: testGenerators,
            basePath: testBasePath
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
