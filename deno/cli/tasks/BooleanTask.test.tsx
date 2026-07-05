import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { BooleanTask } from './BooleanTask.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from '@/components/TaskContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.ts'

// Mock generators data
const mockGenerators: Generator[] = [
  {
    scope: 'skmtc',
    packageName: 'gen-typescript',
    dependencies: []
  },
  {
    scope: 'skmtc',
    packageName: 'gen-zod',
    dependencies: []
  }
]

// Mock setup helpers
const createMockSkmtcRoot = (): SkmtcRoot =>
  ({
    projects: [],
    manager: {
    }
  }) as unknown as SkmtcRoot

const createInitialState = (): SkmtcState => ({
  view: { page: 'home' },
  skmtcRoot: createMockSkmtcRoot(),
  interactive: true,
  message: null,
  shortcuts: [],
  generators: []
})

Deno.test({
  name: 'BooleanTask - selecting Yes shows Yes',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const initialState = createInitialState()
    const mockExit = () => {}

    const { lastFrame, stdin, unmount } = render(
      <SkmtcProvider initialState={initialState} exit={mockExit}>
        <TaskProvider leave={() => {}} tasks={[]}>
          <BooleanTask prompt="Watch for changes?" setValue={() => {}} />
        </TaskProvider>
      </SkmtcProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 250))

    const selectOutput = lastFrame()
    assertEquals(
      selectOutput,
      `│  Watch for changes?
│  ❯ Yes
│    No`
    )

    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 250))

    const resultOutput = lastFrame()
    assertEquals(
      resultOutput,
      `│  Watch for changes?
│  Yes
│`
    )

    unmount()
  }
})

Deno.test({
  name: 'BooleanTask - selecting No shows No',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const initialState = createInitialState()
    const mockExit = () => {}

    const { lastFrame, stdin, unmount } = render(
      <SkmtcProvider initialState={initialState} exit={mockExit}>
        <TaskProvider leave={() => {}} tasks={[]}>
          <BooleanTask prompt="Watch for changes?" setValue={() => {}} />
        </TaskProvider>
      </SkmtcProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 250))

    const selectOutput = lastFrame()

    assertEquals(
      selectOutput,
      `│  Watch for changes?
│  ❯ Yes
│    No`
    )

    stdin.write('\u001B[B')

    await new Promise(resolve => setTimeout(resolve, 250))

    const updatedOutput = lastFrame()

    assertEquals(
      updatedOutput,
      `│  Watch for changes?
│    Yes
│  ❯ No`
    )

    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 250))

    const resultOutput = lastFrame()
    assertEquals(
      resultOutput,
      `│  Watch for changes?
│  No
│`
    )

    unmount()
  }
})
