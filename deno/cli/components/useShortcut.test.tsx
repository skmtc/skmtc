import { render } from 'ink-testing-library'
import { assertEquals, assertExists } from '@std/assert'
import { useShortcut } from '@/components/useShortcut.tsx'
import { SkmtcProvider, type SkmtcState, useSkmtc } from '@/components/SkmtcContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Key } from 'ink'
import { Text } from 'ink'
import { useEffect } from 'react'

// Test component that uses the useShortcut hook
function TestComponent({
  shortcutKey,
  name,
  action
}: {
  shortcutKey: string
  name: string
  action: (input: string, key: Key) => void
}) {
  useShortcut({ key: shortcutKey, name, action })
  return <Text>Test Component</Text>
}

// Component to access and expose the state
function StateInspector({
  callbackRef
}: {
  callbackRef: React.MutableRefObject<(shortcuts: unknown[]) => void>
}) {
  const { state } = useSkmtc()

  useEffect(() => {
    callbackRef.current(state.shortcuts)
  }, [state.shortcuts, callbackRef])

  return null
}

Deno.test('useShortcut - dispatches add-shortcut event after mount', async () => {
  const mockExit = () => {}
  const mockAction = () => {}

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

  let capturedShortcuts: unknown[] = []
  const callbackRef = {
    current: (shortcuts: unknown[]) => {
      capturedShortcuts = shortcuts
    }
  }

  const { unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <TestComponent shortcutKey="s" name="save" action={mockAction} />
      <StateInspector callbackRef={callbackRef} />
    </SkmtcProvider>
  )

  // Wait for React effects to run
  await new Promise(resolve => setTimeout(resolve, 20))

  // Verify that a shortcut was added to the state
  assertEquals(capturedShortcuts.length, 1, 'Expected one shortcut to be added')

  // Verify the shortcut has the correct structure
  const shortcut = capturedShortcuts[0] as { id: string; label: string; action: unknown }
  assertExists(shortcut.id, 'Shortcut should have an id')
  assertEquals(shortcut.label, "'s' to save", 'Shortcut label should match expected format')
  assertEquals(shortcut.action, mockAction, 'Shortcut action should match provided action')

  unmount()

  // Wait a bit more to let any pending promises from SkmtcProvider resolve
  await new Promise(resolve => setTimeout(resolve, 10))
})

Deno.test('useShortcut - does not dispatch when interactive is false and key is esc', () => {
  const mockExit = () => {}
  const mockAction = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: false, // Not interactive
    message: null,
    shortcuts: [],
    generators: []
  }

  let capturedShortcuts: unknown[] = []
  const callbackRef = {
    current: (shortcuts: unknown[]) => {
      capturedShortcuts = shortcuts
    }
  }

  const { unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <TestComponent shortcutKey="esc" name="exit" action={mockAction} />
      <StateInspector callbackRef={callbackRef} />
    </SkmtcProvider>
  )

  // When interactive is false and key is 'esc',
  // the shortcut should NOT be added
  assertEquals(
    capturedShortcuts.length,
    0,
    'No shortcuts should be added when interactive=false and key=esc'
  )

  unmount()
})

Deno.test('useShortcut - dispatches when interactive is true and key is esc', async () => {
  const mockExit = () => {}
  const mockAction = () => {}

  const mockSkmtcRoot = {
    projects: [],
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot: mockSkmtcRoot,
    interactive: true, // Interactive
    message: null,
    shortcuts: [],
    generators: []
  }

  let capturedShortcuts: unknown[] = []
  const callbackRef = {
    current: (shortcuts: unknown[]) => {
      capturedShortcuts = shortcuts
    }
  }

  const { unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <TestComponent shortcutKey="esc" name="exit" action={mockAction} />
      <StateInspector callbackRef={callbackRef} />
    </SkmtcProvider>
  )

  // Wait for React effects to run
  await new Promise(resolve => setTimeout(resolve, 20))

  // When interactive is true, the shortcut SHOULD be added even if key is 'esc'
  assertEquals(
    capturedShortcuts.length,
    1,
    'Shortcut should be added when interactive=true even if key=esc'
  )

  unmount()

  // Wait a bit more to let any pending promises from SkmtcProvider resolve
  await new Promise(resolve => setTimeout(resolve, 10))
})
