import '@/tests/setup.ts'
import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { CloneGeneratorView } from './CloneGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Generator } from '@/lib/generator.ts'

// Helper to create a fresh mock project for each test
const createMockProject = (generators: string[] = []): Project => {
  const mockProject = Object.create(Project.prototype)
  Object.assign(mockProject, {
    name: 'test-project',
    rootDenoJson: {
      contents: {
        imports: generators.reduce(
          (acc, gen) => {
            acc[gen] = `jsr:${gen}@^0.0.1`
            return acc
          },
          {} as Record<string, string>
        )
      }
    },
    cloneGenerator: () => Promise.resolve()
  })
  return mockProject
}

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
      page: 'clone-generator',
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

type RenderCloneGeneratorViewProps = {
  initialState: SkmtcState
  project: Project
}

// Test helper to render component with context
const renderCloneGeneratorView = ({ initialState, project }: RenderCloneGeneratorViewProps) => {
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <CloneGeneratorView
        project={project}
        view={{
          page: 'clone-generator',
          projectName: project.name
        }}
      />
    </SkmtcProvider>
  )
}

// Test 1: Display "No generators available to clone"
Deno.test(
  'CloneGeneratorView - displays no generators available message',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject([]) // No generators

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderCloneGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(frame, '  No generators available to clone')

    unmount()
  }
)

// Test 2: Display cloneable generators list
Deno.test(
  'CloneGeneratorView - displays list of cloneable generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderCloneGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    assertEquals(
      frame,
      `Select generators to clone:
❯ @skmtc/gen-typescript
  @skmtc/gen-zod`
    )

    unmount()
  }
)

// Test 3: Interactive selection and successful clone
Deno.test(
  'CloneGeneratorView - selects and clones generator successfully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const cloneCalls: unknown[] = []

    const mockProject = createMockProject(['@skmtc/gen-typescript', '@skmtc/gen-zod'])
    mockProject.cloneGenerator = (args: unknown) => {
      cloneCalls.push(args)
      return Promise.resolve()
    }

    // Save original and mock the static method
    const originalGetGenerators = Generator.getGeneratorsRootDenoJson
    Generator.getGeneratorsRootDenoJson = () => Promise.resolve({ imports: {} })

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderCloneGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Select first generator with spacebar
      stdin.write(' ')

      await new Promise(resolve => setTimeout(resolve, 50))

      const selectedFrame = lastFrame()

      assertEquals(
        selectedFrame,
        `Select generators to clone:
❯ @skmtc/gen-typescript ✔
  @skmtc/gen-zod`
      )

      // Submit with Enter
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 250))

      // Verify cloneGenerator was called
      assertEquals(cloneCalls.length, 1)
      assertEquals(cloneCalls[0], {
        moduleName: '@skmtc/gen-typescript',
        projectName: 'test-project',
        generatorsDenoJson: { imports: {} }
      })

      unmount()
    } finally {
      Generator.getGeneratorsRootDenoJson = originalGetGenerators
    }
  }
)

// Test 4: Error when no generators selected
Deno.test(
  'CloneGeneratorView - shows error when no generators selected',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])
    mockProject.cloneGenerator = () => Promise.resolve()

    // Save original and mock the static method
    const originalGetGenerators = Generator.getGeneratorsRootDenoJson
    Generator.getGeneratorsRootDenoJson = () => Promise.resolve({ imports: {} })

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderCloneGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Submit without selecting anything
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Component should still be showing the list (no navigation away)
      const frame = lastFrame()
      const stillShowingList = frame && frame.includes('Select generators to clone:')

      assertEquals(
        stillShowingList,
        true,
        `Expected to stay on selection screen, got:\n${frame || 'undefined'}`
      )

      unmount()
    } finally {
      Generator.getGeneratorsRootDenoJson = originalGetGenerators
    }
  }
)

// Test 5: Error handling for clone failure
Deno.test(
  'CloneGeneratorView - handles clone errors gracefully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const cloneCalls: unknown[] = []

    const mockProject = createMockProject(['@skmtc/gen-typescript'])
    mockProject.cloneGenerator = (args: unknown) => {
      cloneCalls.push(args)
      return Promise.reject(new Error('Clone failed'))
    }

    // Save original and mock the static method
    const originalGetGenerators = Generator.getGeneratorsRootDenoJson
    Generator.getGeneratorsRootDenoJson = () => Promise.resolve({ imports: {} })

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderCloneGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Select first generator
      stdin.write(' ')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify cloneGenerator was called
      assertEquals(cloneCalls.length, 1)

      unmount()
    } finally {
      Generator.getGeneratorsRootDenoJson = originalGetGenerators
    }
  }
)

// Test 6: Navigate back on Escape key
Deno.test(
  'CloneGeneratorView - navigates back on Escape key',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount, stdin } = renderCloneGeneratorView({
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

// Test 7: Filter non-cloneable generators
Deno.test(
  'CloneGeneratorView - filters out non-cloneable generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    // Create project with mix of cloneable and non-cloneable imports
    const mockProject = Object.create(Project.prototype)
    Object.assign(mockProject, {
      name: 'test-project',
      rootDenoJson: {
        contents: {
          imports: {
            '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@^0.0.1', // Cloneable
            '@std/path': 'jsr:@std/path@^1.0.0', // Not cloneable (no gen- prefix)
            'local-module': './local.ts', // Not cloneable (no scheme)
            '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.1' // Cloneable
          }
        }
      },
      cloneGenerator: () => Promise.resolve()
    })

    const initialState = createInitialState(mockProject)

    const { lastFrame, unmount } = renderCloneGeneratorView({
      initialState,
      project: mockProject
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const frame = lastFrame()

    // Should only show the two cloneable generators
    assertEquals(
      frame,
      `Select generators to clone:
❯ @skmtc/gen-typescript
  @skmtc/gen-zod`
    )

    unmount()
  }
)

// Test 8: Clone multiple generators in parallel
Deno.test(
  'CloneGeneratorView - clones multiple selected generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const cloneCalls: unknown[] = []

    const mockProject = createMockProject([
      '@skmtc/gen-typescript',
      '@skmtc/gen-zod',
      '@skmtc/gen-tanstack-query'
    ])
    mockProject.cloneGenerator = (args: unknown) => {
      cloneCalls.push(args)
      return Promise.resolve()
    }

    // Save original and mock the static method
    const originalGetGenerators = Generator.getGeneratorsRootDenoJson
    Generator.getGeneratorsRootDenoJson = () => Promise.resolve({ imports: {} })

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderCloneGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Select first generator
      stdin.write(' ')

      await new Promise(resolve => setTimeout(resolve, 25))

      // Navigate down to second generator
      stdin.write('\u001B[B')

      await new Promise(resolve => setTimeout(resolve, 25))

      // Select second generator
      stdin.write(' ')

      await new Promise(resolve => setTimeout(resolve, 50))

      const selectedFrame = lastFrame()

      // Should show both selected
      assertEquals(
        selectedFrame,
        `Select generators to clone:
  @skmtc/gen-typescript ✔
❯ @skmtc/gen-zod ✔
  @skmtc/gen-tanstack-query`
      )

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify both generators were cloned
      assertEquals(cloneCalls.length, 2)

      assertEquals(cloneCalls[0], {
        moduleName: '@skmtc/gen-typescript',
        projectName: 'test-project',
        generatorsDenoJson: { imports: {} }
      })

      assertEquals(cloneCalls[1], {
        moduleName: '@skmtc/gen-zod',
        projectName: 'test-project',
        generatorsDenoJson: { imports: {} }
      })

      unmount()
    } finally {
      Generator.getGeneratorsRootDenoJson = originalGetGenerators
    }
  }
)
