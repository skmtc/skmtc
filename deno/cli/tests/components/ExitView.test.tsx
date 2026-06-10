import { render } from 'ink-testing-library'
import { assertExists } from '@std/assert'
import { ExitView } from '@/components/ExitView.tsx'
import { SkmtcProvider, SkmtcState } from '@/components/SkmtcContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertEquals } from '@std/assert/equals'

Deno.test('ExitView - renders', () => {

  let exitCount = 0
  const mockExit = () => {
    exitCount++
  }

  const mockSkmtcRoot = {
    manager: {}
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'exit' },
    skmtcRoot: mockSkmtcRoot,
    message: null,
    interactive: true,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <ExitView />
    </SkmtcProvider>
  )

  const output = lastFrame()

  console.log(output)

  assertExists(output)
  assertEquals(output, '')
  assertEquals(exitCount, 1)

  unmount()
})
