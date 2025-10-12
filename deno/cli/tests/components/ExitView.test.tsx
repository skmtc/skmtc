import { render } from 'ink-testing-library'
import { assertExists } from '@std/assert'
import { ExitView } from '@/components/ExitView.tsx'
import { SkmtcProvider } from "../../components/SkmtcContext.tsx";
import { createTestSession } from "../mocks/session.mock.ts";
import { SkmtcRoot } from "../../lib/skmtc-root.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test('ExitView - renders', () => {
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

  const { lastFrame } = render(
    <SkmtcProvider view={{ page: 'exit' }} skmtcRoot={mockSkmtcRoot} session={mockSession} interactive> 
      <ExitView />
    </SkmtcProvider>
  )

  const output = lastFrame()

  assertExists(output)
  assertEquals(output, '')
})