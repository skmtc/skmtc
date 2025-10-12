import { render } from 'ink-testing-library'
import { assertExists, assertStringIncludes, assertEquals } from '@std/assert'
import { MessageBox } from '@/components/MessageBox.tsx'
import { SkmtcProvider, SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

Deno.test('MessageBox - renders nothing when no message', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertEquals(output, '')
  
  unmount()
})

Deno.test('MessageBox - renders error message', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: {
      content: { error: 'Something went wrong' },
      timeout: 123
    },
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertStringIncludes(output, 'Something went wrong')
  
  unmount()
})

Deno.test('MessageBox - renders success message', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: {
      content: { success: 'Operation completed successfully' },
      timeout: 123
    },
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertStringIncludes(output, 'Operation completed successfully')
  
  unmount()
})

Deno.test('MessageBox - renders info message', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: {
      content: { info: 'This is some information' },
      timeout: 123
    },
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertStringIncludes(output, 'This is some information')
  
  unmount()
})

Deno.test('MessageBox - renders message with sub-text', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: {
      content: { 
        success: 'Main message',
        sub: 'Additional details here'
      },
      timeout: 123
    },
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertStringIncludes(output, 'Main message')
  assertStringIncludes(output, 'Additional details here')
  
  unmount()
})

Deno.test('MessageBox - renders correctly in non-interactive mode', () => {
  const mockSession = createTestSession()
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
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

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: false,
    message: {
      content: { info: 'Non-interactive message' },
      timeout: 123
    },
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()
  
  assertExists(output)
  assertStringIncludes(output, 'Non-interactive message')
  
  unmount()
})