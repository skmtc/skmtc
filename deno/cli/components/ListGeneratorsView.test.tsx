import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { ListGeneratorsView } from './ListGeneratorsView.tsx'
import { App } from './App.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import type { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

// Mock SkmtcRoot
const createMockSkmtcRoot = (project: Project): SkmtcRoot =>
  ({
    projects: [project],
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: [], error: null })
          }
        }
      },
      cleanup: () => Promise.resolve()
    },
    findProject: (name: string) => (name === project.name ? project : null)
  }) as unknown as SkmtcRoot

// Helper to create initial state
const createInitialState = (project: Project): SkmtcState => {
  const skmtcRoot = createMockSkmtcRoot(project)

  return {
    view: {
      page: 'list-generators',
      projectName: project.name
    },
    skmtcRoot,
    session: createTestSession(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }
}

// Test helper to render component with context
const renderListGenerators = (project: Project) => {
  const initialState = createInitialState(project)
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <ListGeneratorsView
        project={project}
        view={{
          page: 'list-generators',
          projectName: project.name
        }}
      />
    </SkmtcProvider>
  )
}

// Test 1: Display generators list with multiple generators
Deno.test(
  'ListGeneratorsView - displays list of generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, {
      name: 'test-project',
      generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
    })

    const { lastFrame, unmount } = renderListGenerators(mockProject)

    await new Promise(resolve => setTimeout(resolve, 100))

    const output = lastFrame()

    assertEquals(
      output,
      `Generators in test-project:
 • @skmtc/gen-typescript
 • @skmtc/gen-zod`
    )

    unmount()
  }
)

// Test 2: Display empty state when no generators
Deno.test(
  'ListGeneratorsView - displays empty state for no generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, {
      name: 'test-project',
      generators: []
    })

    const { lastFrame, unmount } = renderListGenerators(mockProject)

    await new Promise(resolve => setTimeout(resolve, 100))

    const output = lastFrame()

    assertEquals(
      output,
      `Generators in test-project:
No generators found`
    )

    unmount()
  }
)

// Test 3: Escape key press
Deno.test(
  'ListGeneratorsView - handles escape key press',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, {
      name: 'test-project',
      generators: ['@skmtc/gen-typescript']
    })

    const { lastFrame, unmount, stdin } = renderListGenerators(mockProject)

    await new Promise(resolve => setTimeout(resolve, 100))

    // Capture output before escape
    const beforeEscape = lastFrame()

    assertEquals(
      beforeEscape,
      `Generators in test-project:
 • @skmtc/gen-typescript`
    )

    // Press escape key
    stdin.write('\u001B')

    await new Promise(resolve => setTimeout(resolve, 100))

    // Component should still be rendering (we can't verify dispatch was called)
    const afterEscape = lastFrame()

    assertEquals(
      afterEscape,
      `Generators in test-project:
 • @skmtc/gen-typescript`
    )

    unmount()
  }
)

// Test 4: Display multiple generators with different names
Deno.test(
  'ListGeneratorsView - displays multiple generators correctly',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, {
      name: 'my-api-project',
      generators: [
        '@skmtc/gen-typescript',
        '@skmtc/gen-zod',
        '@skmtc/gen-tanstack-query',
        '@custom/my-generator'
      ]
    })

    const { lastFrame, unmount } = renderListGenerators(mockProject)

    await new Promise(resolve => setTimeout(resolve, 100))

    const output = lastFrame()

    assertEquals(
      output,
      `Generators in my-api-project:
 • @skmtc/gen-typescript
 • @skmtc/gen-zod
 • @skmtc/gen-tanstack-query
 • @custom/my-generator`
    )

    unmount()
  }
)

// Test 5: Integration test - escape key navigates back to project view
Deno.test(
  'ListGeneratorsView - escape key navigates to project view (integration)',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, {
      name: 'test-project',
      generators: ['@skmtc/gen-typescript']
    })

    const skmtcRoot = createMockSkmtcRoot(mockProject)

    // Start with list-generators view
    const initialState: SkmtcState = {
      view: {
        page: 'list-generators',
        projectName: mockProject.name
      },
      skmtcRoot,
      session: createTestSession(),
      interactive: true,
      message: null,
      shortcuts: [],
      generators: []
    }

    const mockExit = () => {}

    const { lastFrame, unmount, stdin } = render(
      <SkmtcProvider initialState={initialState} exit={mockExit}>
        <App initialState={initialState} />
      </SkmtcProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 150))

    // Should show list-generators view
    const beforeEscape = lastFrame()

    // Verify we're on list-generators view with full string check
    assertEquals(
      beforeEscape,
      `┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ＊ Skmtc CLI (v0.0.336)                                                    Logged in as testuser │
│                                                                                                  │
│ project: test-project                                          directory: ~/workspace/skmtc-root │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

Generators in test-project:
 • @skmtc/gen-typescript

  'esc' to test-project`
    )

    // Press escape key
    stdin.write('\x1B')

    await new Promise(resolve => setTimeout(resolve, 150))

    // Should navigate back to project view (showing action menu)
    const afterEscape = lastFrame()

    // Verify we're on project view with full string check
    assertEquals(
      afterEscape,
      `┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ＊ Skmtc CLI (v0.0.336)                                                    Logged in as testuser │
│                                                                                                  │
│ project: test-project                                          directory: ~/workspace/skmtc-root │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

❯ Generate artifacts

  Install generator
  Create new generator
  Clone generator
  Remove generator

  'esc' to home`
    )

    unmount()
  }
)
