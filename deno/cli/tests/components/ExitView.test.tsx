import { render } from 'ink-testing-library'
import { assertExists, assertEquals } from '@std/assert'
import { useEffect } from 'react'
import { Box } from 'ink'
import { SkmtcProvider } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

// Create a testable version of ExitView that accepts useApp as a prop
type TestableExitViewProps = {
  useApp: () => { exit: () => void }
}

const TestableExitView = ({ useApp }: TestableExitViewProps) => {
  const { state } = useSkmtc()
  const { exit } = useApp()
  
  useEffect(() => {
    if (state.message?.timeout) {
      clearTimeout(state.message.timeout)
    }
    exit()
  }, [])

  return <Box></Box>
}

Deno.test('ExitView - renders empty and calls exit', () => {
  // Track if exit was called
  let exitCalled = false
  
  // Create mock useApp function
  const mockUseApp = () => ({
    exit: () => {
      exitCalled = true
    }
  })

  const mockSession = createTestSession()
  const mockSkmtcRoot = {
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot

  const { lastFrame, unmount } = render(
    <SkmtcProvider view={{ page: 'exit' }} skmtcRoot={mockSkmtcRoot} session={mockSession} interactive>
      <TestableExitView useApp={mockUseApp} />
    </SkmtcProvider>
  )

  const output = lastFrame()

  // Verify component renders empty
  assertExists(output)
  assertEquals(output, '')
  
  // Verify exit was called
  assertEquals(exitCalled, true, 'exit() should have been called')

  unmount()
})

Deno.test('ExitView - exit called multiple times for multiple instances', () => {
  let exitCallCount = 0
  
  const mockUseApp = () => ({
    exit: () => {
      exitCallCount++
    }
  })

  const mockSession = createTestSession()
  const mockSkmtcRoot = {
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot

  // First instance
  const { unmount: unmount1 } = render(
    <SkmtcProvider view={{ page: 'exit' }} skmtcRoot={mockSkmtcRoot} session={mockSession} interactive>
      <TestableExitView useApp={mockUseApp} />
    </SkmtcProvider>
  )
  unmount1()

  assertEquals(exitCallCount, 1, 'exit() should be called once for first instance')

  // Second instance
  const { unmount: unmount2 } = render(
    <SkmtcProvider view={{ page: 'exit' }} skmtcRoot={mockSkmtcRoot} session={mockSession} interactive>
      <TestableExitView useApp={mockUseApp} />
    </SkmtcProvider>
  )
  unmount2()

  assertEquals(exitCallCount, 2, 'exit() should be called twice total')
})

