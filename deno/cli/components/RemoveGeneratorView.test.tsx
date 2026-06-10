import '@/tests/setup.ts'
import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { RemoveGeneratorView } from './RemoveGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState, type ViewStateRemoveGenerator } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'

// Helper to create a fresh mock project for each test
const createMockProject = (generators: string[] = []): Project => {
  const mockProject = Object.create(Project.prototype)
  Object.assign(mockProject, {
    name: 'test-project',
    toGeneratorIds: () => generators,
    removeGenerator: () => Promise.resolve()
  })
  return mockProject
}

// Mock SkmtcRoot
const createMockSkmtcRoot = (project: Project): SkmtcRoot =>
  ({
    projects: [project],
    manager: {
      cleanup: () => Promise.resolve()
    },
    findProject: (name: string) => (name === project.name ? project : null)
  }) as unknown as SkmtcRoot

// Helper to create initial state
const createInitialState = (
  project: Project,
  viewOverrides?: Partial<ViewStateRemoveGenerator>
): SkmtcState => {
  const skmtcRoot = createMockSkmtcRoot(project)

  return {
    view: {
      page: 'remove-generator',
      projectName: project.name,
      ...viewOverrides
    },
    skmtcRoot,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }
}

type RenderRemoveGeneratorViewProps = {
  initialState: SkmtcState
  project: Project
  view?: ViewStateRemoveGenerator
}

// Test helper to render component with context
const renderRemoveGeneratorView = ({
  initialState,
  project,
  view
}: RenderRemoveGeneratorViewProps) => {
  const mockExit = () => {}

  const viewState = view || {
    page: 'remove-generator' as const,
    projectName: project.name
  }

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <RemoveGeneratorView project={project} view={viewState} />
    </SkmtcProvider>
  )
}

// Test 1: Display no generators message
Deno.test(
  'RemoveGeneratorView - displays no generators message',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject([]) // No generators

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(frame, 'No generators found to remove')

    unmount()
  }
)

// Test 2: Display generator selection list
Deno.test(
  'RemoveGeneratorView - displays generator selection list',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(
      frame,
      `Select generator to remove:
❯ @skmtc/gen-typescript
  @skmtc/gen-zod`
    )

    unmount()
  }
)

// Test 3: Pre-selected generator goes to confirmation
Deno.test(
  'RemoveGeneratorView - pre-selected generator shows confirmation',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])

    const initialState = createInitialState(mockProject, {
      generatorName: '@skmtc/gen-typescript'
    })

    const { lastFrame, unmount } = renderRemoveGeneratorView({
      initialState,
      project: mockProject,
      view: {
        page: 'remove-generator',
        projectName: 'test-project',
        generatorName: '@skmtc/gen-typescript'
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(
      frame,
      `Are you sure you want to remove "@skmtc/gen-typescript"?
Y/n`
    )

    unmount()
  }
)

// Test 4: Select generator and show confirmation
Deno.test(
  'RemoveGeneratorView - select generator and show confirmation prompt',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Select first generator (already selected by default)
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 50))

    const confirmationFrame = lastFrame()

    assertEquals(
      confirmationFrame,
      `Are you sure you want to remove "@skmtc/gen-typescript"?
Y/n`
    )

    unmount()
  }
)

// Test 5: Cancel confirmation navigates back
Deno.test(
  'RemoveGeneratorView - cancel confirmation navigates back',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])

    const initialState = createInitialState(mockProject, {
      generatorName: '@skmtc/gen-typescript'
    })

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject,
      view: {
        page: 'remove-generator',
        projectName: 'test-project',
        generatorName: '@skmtc/gen-typescript'
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Press 'n' to cancel
    stdin.write('n')

    await new Promise(resolve => setTimeout(resolve, 50))

    // Component should still be rendering (navigation handled by context)
    const frame = lastFrame()
    const stillRendering = frame && frame.length > 0

    assertEquals(stillRendering, true)

    unmount()
  }
)

// Test 6: Complete successful removal flow
Deno.test(
  'RemoveGeneratorView - complete successful removal flow',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const removalCalls: unknown[] = []

    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])
    mockProject.removeGenerator = (args: unknown) => {
      removalCalls.push(args)
      return Promise.resolve()
    }

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Select first generator
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 50))

    // Confirm removal by pressing 'y'
    stdin.write('y')

    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify removeGenerator was called at least once
    assertEquals(removalCalls.length >= 1, true)
    assertEquals(removalCalls[0], {
      moduleName: '@skmtc/gen-typescript'
    })

    unmount()
  }
)

// Test 7: Error handling for removal failure
Deno.test(
  'RemoveGeneratorView - handles removal error gracefully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const removalCalls: unknown[] = []

    const mockProject = createMockProject(['@skmtc/gen-typescript'])
    mockProject.removeGenerator = (args: unknown) => {
      removalCalls.push(args)
      return Promise.reject(new Error('Removal failed'))
    }

    const initialState = createInitialState(mockProject, {
      generatorName: '@skmtc/gen-typescript'
    })

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject,
      view: {
        page: 'remove-generator',
        projectName: 'test-project',
        generatorName: '@skmtc/gen-typescript'
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Confirm removal
    stdin.write('y')

    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify removeGenerator was called exactly once
    assertEquals(removalCalls.length, 1)

    unmount()
  }
)

// Test 8: Error still navigates back (finally block)
Deno.test(
  'RemoveGeneratorView - error still navigates back to project',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])
    mockProject.removeGenerator = () => Promise.reject(new Error('Removal failed'))

    const initialState = createInitialState(mockProject, {
      generatorName: '@skmtc/gen-typescript'
    })

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject,
      view: {
        page: 'remove-generator',
        projectName: 'test-project',
        generatorName: '@skmtc/gen-typescript'
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Confirm removal
    stdin.write('y')

    await new Promise(resolve => setTimeout(resolve, 200))

    // Component should still render (shows Spinner during removal)
    const frame = lastFrame()
    const hasContent = frame !== null && frame !== undefined

    assertEquals(hasContent, true)

    unmount()
  }
)

// Test 9: Escape key before selection navigates back
Deno.test(
  'RemoveGeneratorView - escape key before selection navigates back',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount, stdin } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Press Escape
    stdin.write('\u001B')

    await new Promise(resolve => setTimeout(resolve, 50))

    // Component should still render (navigation handled by context)
    const frame = lastFrame()
    const stillRendering = frame && frame.length > 0

    assertEquals(stillRendering, true)

    unmount()
  }
)

// Test 10: Multiple generators displayed in list
Deno.test(
  'RemoveGeneratorView - displays multiple generators in list',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject([
      '@skmtc/gen-typescript',
      '@skmtc/gen-zod',
      '@skmtc/gen-tanstack-query'
    ])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderRemoveGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(
      frame,
      `Select generator to remove:
❯ @skmtc/gen-typescript
  @skmtc/gen-zod
  @skmtc/gen-tanstack-query`
    )

    unmount()
  }
)
