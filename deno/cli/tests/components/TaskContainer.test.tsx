import { render } from 'ink-testing-library'
import { assertExists, assertEquals, assertStringIncludes } from '@std/assert'
import { TaskContainer } from '@/components/TaskContainer.tsx'
import { TaskProvider } from '@/components/TaskContext.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import React from 'react'
import { Text } from 'ink'

Deno.test('TaskContainer - renders with prompt and children', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockLeave = () => {}
  const mockManager = createMockManager()

  // Mock generators API response
  // @ts-ignore: access mock for testing
  const supabaseMock = mockManager._supabaseMock
  supabaseMock.mockResponse('/generators', {
    data: [],
    error: null
  })

  const mockSkmtcRoot = {
    projects: [],
    manager: mockManager
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <TaskProvider leave={mockLeave} tasks={[]}>
        <TaskContainer prompt="Test Prompt">
          <Text>Test Content</Text>
        </TaskContainer>
      </TaskProvider>
    </SkmtcProvider>
  )

  const output = lastFrame()

  assertExists(output)
  assertStringIncludes(output, 'Test Prompt')
  assertStringIncludes(output, 'Test Content')

  unmount()
})
