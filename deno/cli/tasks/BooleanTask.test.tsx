import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { BooleanTask } from './BooleanTask.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { TaskProvider } from '@/components/TaskContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.generated.ts'

// Mock generators data
const mockGenerators: Generator[] = [
  {
    id: '1',
    name: 'TypeScript Generator',
    description: 'Generate TypeScript types',
    dependencies: [],
    sourceUrl: 'https://github.com/skmtc/gen-typescript',
    registryUrl: 'https://jsr.io/@skmtc/gen-typescript',
    readme: 'TypeScript generator',
    scope: 'skmtc',
    packageName: 'gen-typescript',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'Zod Generator',
    description: 'Generate Zod schemas',
    dependencies: [],
    sourceUrl: 'https://github.com/skmtc/gen-zod',
    registryUrl: 'https://jsr.io/@skmtc/gen-zod',
    readme: 'Zod generator',
    scope: 'skmtc',
    packageName: 'gen-zod',
    createdAt: '2024-01-01T00:00:00Z'
  }
]

// Mock setup helpers
const createMockSkmtcRoot = (): SkmtcRoot =>
  ({
    projects: [],
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: (path: string) => {
              if (path === '/generators') {
                return Promise.resolve({ data: mockGenerators, error: null })
              }
              return Promise.resolve({ data: [], error: null })
            }
          }
        }
      }
    }
  }) as unknown as SkmtcRoot

const createInitialState = (): SkmtcState => ({
  view: { page: 'home' },
  skmtcRoot: createMockSkmtcRoot(),
  session: createTestSession(),
  interactive: true,
  message: null,
  shortcuts: [],
  generators: []
})

Deno.test('BooleanTask - selecting Yes shows Yes', async () => {
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
})

Deno.test('BooleanTask - selecting No shows No', async () => {
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
})
