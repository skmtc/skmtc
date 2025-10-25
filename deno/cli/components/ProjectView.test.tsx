import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { ProjectView } from './ProjectView.tsx'
import { SkmtcProvider, type SkmtcState } from './SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.generated.ts'
import type { Project } from '@/lib/project.ts'

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

const createMockProject = (): Project =>
  ({
    name: 'test-project'
  }) as unknown as Project

const createInitialState = (): SkmtcState => ({
  view: { page: 'project', projectName: 'test-project' },
  skmtcRoot: createMockSkmtcRoot(),
  session: createTestSession(),
  interactive: true,
  message: null,
  shortcuts: [],
  generators: []
})

// ============================================================================
// Rendering Tests
// ============================================================================

Deno.test('ProjectView - renders project action menu', async () => {
  const initialState = createInitialState()
  const mockProject = createMockProject()
  const mockExit = () => {}

  const { lastFrame, unmount } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <ProjectView project={mockProject} />
    </SkmtcProvider>
  )

  await new Promise(resolve => setTimeout(resolve, 150))

  const output = lastFrame()
  assertEquals(
    output,
    `❯ Generate artifacts

  Install generator
  Create new generator
  Clone generator
  Remove generator`
  )

  unmount()
})

// ============================================================================
// Selection Tests
// ============================================================================

Deno.test({
  name: 'ProjectView - selecting Generate artifacts shows menu',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const initialState = createInitialState()
    const mockProject = createMockProject()
    const mockExit = () => {}

    const { stdin, lastFrame, unmount } = render(
      <SkmtcProvider initialState={initialState} exit={mockExit}>
        <ProjectView project={mockProject} />
      </SkmtcProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 150))

    const beforeOutput = lastFrame()
    assertEquals(
      beforeOutput,
      `❯ Generate artifacts

  Install generator
  Create new generator
  Clone generator
  Remove generator`
    )

    // Select first option (Generate artifacts)
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 150))

    unmount()
  }
})

Deno.test({
  name: 'ProjectView - navigate to Install generator with down arrow',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const initialState = createInitialState()
    const mockProject = createMockProject()
    const mockExit = () => {}

    const { stdin, lastFrame, unmount } = render(
      <SkmtcProvider initialState={initialState} exit={mockExit}>
        <ProjectView project={mockProject} />
      </SkmtcProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 150))

    // Navigate to second option (Install generator)
    stdin.write('\x1B[B')

    await new Promise(resolve => setTimeout(resolve, 150))

    const output = lastFrame()
    assertEquals(
      output,
      `  Generate artifacts

❯ Install generator
  Create new generator
  Clone generator
  Remove generator`
    )

    unmount()
  }
})
