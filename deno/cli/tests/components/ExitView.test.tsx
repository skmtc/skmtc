import { render } from 'ink-testing-library'
import { assertExists } from '@std/assert'
import { ExitView } from '@/components/ExitView.tsx'
import { SkmtcProvider } from "@/components/SkmtcContext.tsx";
import { createTestSession } from "../mocks/session.mock.ts";
import type { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test('ExitView - renders', () => {
  const mockSession = createTestSession()

  let exitCount = 0
  const mockExit = () => {
    exitCount++
  }

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
    <SkmtcProvider view={{ page: 'exit' }} skmtcRoot={mockSkmtcRoot} session={mockSession} exit={mockExit} interactive> 
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