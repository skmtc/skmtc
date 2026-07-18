import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { AddGeneratorView } from './AddGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertSpyCall, stub } from '@std/testing/mock'

// Helper to create a fresh mock project for each test
const createMockProject = (): Project => {
  const mockProject = Object.create(Project.prototype)
  Object.assign(mockProject, {
    name: 'test-project',
    addGenerator: () => Promise.resolve()
  })
  return mockProject
}

// Mock SkmtcRoot
const createMockSkmtcRoot = (project: Project): SkmtcRoot =>
  ({
    projects: [project],
    manager: {
      cleanup: () => Promise.resolve()
    }
  }) as unknown as SkmtcRoot

// Helper to create initial state
const createInitialState = (project: Project): SkmtcState => {
  const skmtcRoot = createMockSkmtcRoot(project)

  return {
    view: {
      page: 'create-generator',
      projectName: project.name
    },
    skmtcRoot,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }
}

type RenderAddGeneratorViewProps = {
  initialState: SkmtcState
  project: Project
}

// Test helper to render component with context
const renderAddGeneratorView = ({ initialState, project }: RenderAddGeneratorViewProps) => {
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <AddGeneratorView
        project={project}
        view={{
          page: 'create-generator',
          projectName: project.name
        }}
      />
    </SkmtcProvider>
  )
}

// Test 1: Interactive flow - Select type and enter name
Deno.test(
  'AddGeneratorView - requests type and name interactively',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject()
    const addGeneratorStub = stub(mockProject, 'addGenerator', () => Promise.resolve())

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderAddGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should show generator type prompt
      const typePrompt = lastFrame()

      assertEquals(
        typePrompt,
        `│  Generator type
│  ❯ operation
│    model`
      )

      // Select "operation" (already selected)
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should show generator name prompt
      const namePrompt = lastFrame()

      assertEquals(
        namePrompt,
        `│  Generator type
│  operation
│
│  Generator name
│`
      )

      // Type generator name
      stdin.write('my-generator')

      await new Promise(resolve => setTimeout(resolve, 25))

      const nameInput = lastFrame()

      assertEquals(
        nameInput,
        `│  Generator type
│  operation
│
│  Generator name
│  my-generator`
      )

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should show adding spinner
      const addingFrame = lastFrame()

      const hasAddingSpinner = addingFrame && addingFrame.includes('Adding generator...')

      assertEquals(
        hasAddingSpinner,
        true,
        `Expected adding spinner, got:\n${addingFrame || 'undefined'}`
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify addGenerator was called with correct arguments
      assertSpyCall(addGeneratorStub, 0, {
        args: [
          {
            moduleName: 'my-generator',
            type: 'operation',
            language: undefined
          }
        ]
      })

      unmount()
    } finally {
      addGeneratorStub.restore()
    }
  }
)

// Test 2: Select "model" type
Deno.test(
  'AddGeneratorView - can select model type',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject()
    const addGeneratorStub = stub(mockProject, 'addGenerator', () => Promise.resolve())

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderAddGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Navigate to "model" option
      stdin.write('\u001B[B') // Arrow down

      await new Promise(resolve => setTimeout(resolve, 25))

      const modelSelected = lastFrame()

      assertEquals(
        modelSelected,
        `│  Generator type
│    operation
│  ❯ model`
      )

      // Select "model"
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Type generator name
      stdin.write('user-model')

      await new Promise(resolve => setTimeout(resolve, 25))

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify addGenerator was called with model type
      assertSpyCall(addGeneratorStub, 0, {
        args: [
          {
            moduleName: 'user-model',
            type: 'model',
            language: undefined
          }
        ]
      })

      unmount()
    } finally {
      addGeneratorStub.restore()
    }
  }
)

// Test 3: Error handling
Deno.test(
  'AddGeneratorView - handles errors gracefully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const mockProject = createMockProject()
    const addGeneratorStub = stub(mockProject, 'addGenerator', () =>
      Promise.reject(new Error('Generator creation failed'))
    )

    const initialState = createInitialState(mockProject)

    try {
      const { lastFrame, unmount, stdin } = renderAddGeneratorView({
        initialState,
        project: mockProject
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Select operation
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Type generator name
      stdin.write('failing-generator')

      await new Promise(resolve => setTimeout(resolve, 25))

      // Submit
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify addGenerator was called
      assertSpyCall(addGeneratorStub, 0, {
        args: [
          {
            moduleName: 'failing-generator',
            type: 'operation',
            language: undefined
          }
        ]
      })

      // Component should handle error and unmount gracefully
      unmount()
    } finally {
      addGeneratorStub.restore()
    }
  }
)
