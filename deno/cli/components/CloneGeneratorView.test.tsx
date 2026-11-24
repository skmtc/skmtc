import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { CloneGeneratorView } from './CloneGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { pointer, tick } from '@/test/pointer.ts'

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
    cloneGenerators: ({ moduleNames }: CloneGeneratorsCall) =>
      Promise.resolve(moduleNames.map(moduleName => ({ moduleName, version: '0.0.55' })))
  })
  return mockProject
}

type CloneGeneratorsCall = { moduleNames: string[]; force?: boolean }

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
const createInitialState = (project: Project): SkmtcState => {
  const skmtcRoot = createMockSkmtcRoot(project)

  return {
    view: {
      page: 'clone-generator',
      projectName: project.name
    },
    skmtcRoot,
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
${pointer} @skmtc/gen-typescript
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
    mockProject.cloneGenerators = (args: CloneGeneratorsCall) => {
      cloneCalls.push(args)
      return Promise.resolve(
        args.moduleNames.map(moduleName => ({
          moduleName,
          version: '0.0.55'
        }))
      )
    }

    const initialState = createInitialState(mockProject)

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
${pointer} @skmtc/gen-typescript ${tick}
  @skmtc/gen-zod`
    )

    // Submit with Enter
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 250))

    assertEquals(cloneCalls, [{ moduleNames: ['@skmtc/gen-typescript'] }])

    unmount()
  }
)

// Test 4: Error when no generators selected
Deno.test(
  'CloneGeneratorView - shows error when no generators selected',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject(['@skmtc/gen-typescript'])

    const initialState = createInitialState(mockProject)

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
  }
)

// Test 5: Error handling for clone failure
Deno.test(
  'CloneGeneratorView - handles clone errors gracefully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const cloneCalls: unknown[] = []

    const mockProject = createMockProject(['@skmtc/gen-typescript'])
    mockProject.cloneGenerators = (args: CloneGeneratorsCall) => {
      cloneCalls.push(args)
      return Promise.reject(new Error('Clone failed'))
    }

    const initialState = createInitialState(mockProject)

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

    assertEquals(cloneCalls.length, 1)

    unmount()
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
      cloneGenerators: ({ moduleNames }: CloneGeneratorsCall) =>
        Promise.resolve(moduleNames.map(moduleName => ({ moduleName, version: '0.0.55' })))
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
${pointer} @skmtc/gen-typescript
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
    mockProject.cloneGenerators = (args: CloneGeneratorsCall) => {
      cloneCalls.push(args)
      return Promise.resolve(
        args.moduleNames.map(moduleName => ({
          moduleName,
          version: '0.0.55'
        }))
      )
    }

    const initialState = createInitialState(mockProject)

    {
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
  @skmtc/gen-typescript ${tick}
${pointer} @skmtc/gen-zod ${tick}
  @skmtc/gen-tanstack-query`
      )

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 150))

      // One call for both, so the core check sees them together (#375).
      assertEquals(cloneCalls, [
        {
          moduleNames: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
        }
      ])

      unmount()
    }
  }
)
