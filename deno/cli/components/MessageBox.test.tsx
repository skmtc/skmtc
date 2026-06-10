import { render } from 'ink-testing-library'
import { assertExists, assertStringIncludes, assertEquals } from '@std/assert'
import { MessageBox } from '@/components/MessageBox.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

Deno.test('MessageBox - renders nothing when no message', () => {
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
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
      <MessageBox />
    </SkmtcProvider>
  )

  const output = lastFrame()

  assertExists(output)
  assertEquals(output, '')

  unmount()
})

Deno.test('MessageBox - renders error message', () => {
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true,
    message: {
      content: { error: 'Something went wrong' }
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
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true,
    message: {
      content: { success: 'Operation completed successfully' }
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
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true,
    message: {
      content: { info: 'This is some information' }
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
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true,
    message: {
      content: {
        success: 'Main message',
        sub: 'Additional details here'
      }
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
  const mockExit = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: false,
    message: {
      content: { info: 'Non-interactive message' }
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
