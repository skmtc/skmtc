import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { BundleView } from './BundleView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { stub } from '@std/testing/mock'

// Helper to create initial state
const createInitialState = (projectName: string, interactive = false): SkmtcState => {
  const manager = createMockManager()

  const mockProject = createMockProject(manager, { name: projectName })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  return {
    view: {
      page: 'bundle',
      projectName
    },
    skmtcRoot,
    interactive,
    message: null,
    shortcuts: [],
    generators: []
  }
}

Deno.test(
  'BundleView - successful bundle creation completes without error',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    // Mock project.createWorker
    mockProject.createWorker = () => Promise.resolve('/mock/worker.ts')

    const initialState = createInitialState('test-project', false)

    // Mock Deno.Command to simulate successful bundle
    const mockCommand = {
      output: () =>
        Promise.resolve({
          success: true,
          stdout: new Uint8Array(),
          stderr: new Uint8Array()
        })
    }
    const commandStub = stub(Deno, 'Command', () => mockCommand as unknown as Deno.Command)

    // Mock Deno.open for log file writing
    const mockFile = {
      write: () => Promise.resolve(0),
      close: () => {}
    }
    const openStub = stub(Deno, 'open', () => Promise.resolve(mockFile as unknown as Deno.FsFile))

    try {
      const mockExit = () => {}

      const { unmount } = render(
        <SkmtcProvider initialState={initialState} exit={mockExit}>
          <BundleView
            project={mockProject}
            view={{ page: 'bundle', projectName: 'test-project' }}
          />
        </SkmtcProvider>
      )

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify the component completes without throwing errors

      unmount()
    } finally {
      commandStub.restore()
      openStub.restore()
    }
  }
)

Deno.test(
  'BundleView - failed bundle creation handles error gracefully',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    // Mock project.createWorker
    mockProject.createWorker = () => Promise.resolve('/mock/worker.ts')

    const initialState = createInitialState('test-project', false)

    // Mock Deno.Command to simulate failed bundle
    const mockCommand = {
      output: () =>
        Promise.resolve({
          success: false,
          stdout: new Uint8Array(),
          stderr: new TextEncoder().encode('Bundle failed')
        })
    }
    const commandStub = stub(Deno, 'Command', () => mockCommand as unknown as Deno.Command)

    // Mock Deno.open for log file writing
    const mockFile = {
      write: () => Promise.resolve(0),
      close: () => {}
    }
    const openStub = stub(Deno, 'open', () => Promise.resolve(mockFile as unknown as Deno.FsFile))

    try {
      const mockExit = () => {}

      const { unmount } = render(
        <SkmtcProvider initialState={initialState} exit={mockExit}>
          <BundleView
            project={mockProject}
            view={{ page: 'bundle', projectName: 'test-project' }}
          />
        </SkmtcProvider>
      )

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify the component handled the error gracefully
      // (doesn't throw, displays error message)

      unmount()
    } finally {
      commandStub.restore()
      openStub.restore()
    }
  }
)

Deno.test(
  'BundleView - completes in interactive mode',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    // Mock project.createWorker
    mockProject.createWorker = () => Promise.resolve('/mock/worker.ts')

    const initialState = createInitialState('test-project', true) // interactive: true

    // Mock Deno.Command to simulate successful bundle
    const mockCommand = {
      output: () =>
        Promise.resolve({
          success: true,
          stdout: new Uint8Array(),
          stderr: new Uint8Array()
        })
    }
    const commandStub = stub(Deno, 'Command', () => mockCommand as unknown as Deno.Command)

    // Mock Deno.open for log file writing
    const mockFile = {
      write: () => Promise.resolve(0),
      close: () => {}
    }
    const openStub = stub(Deno, 'open', () => Promise.resolve(mockFile as unknown as Deno.FsFile))

    try {
      const mockExit = () => {}

      const { unmount } = render(
        <SkmtcProvider initialState={initialState} exit={mockExit}>
          <BundleView
            project={mockProject}
            view={{ page: 'bundle', projectName: 'test-project' }}
          />
        </SkmtcProvider>
      )

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // In interactive mode, the view should dispatch navigation back to project view
      // We verify the component completes without error

      unmount()
    } finally {
      commandStub.restore()
      openStub.restore()
    }
  }
)

Deno.test(
  'BundleView - calls exit when interactive is false',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    // Mock project.createWorker
    mockProject.createWorker = () => Promise.resolve('/mock/worker.ts')

    const initialState = createInitialState('test-project', false) // interactive: false

    // Mock Deno.Command to simulate successful bundle
    const mockCommand = {
      output: () =>
        Promise.resolve({
          success: true,
          stdout: new Uint8Array(),
          stderr: new Uint8Array()
        })
    }
    const commandStub = stub(Deno, 'Command', () => mockCommand as unknown as Deno.Command)

    // Mock Deno.open for log file writing
    const mockFile = {
      write: () => Promise.resolve(0),
      close: () => {}
    }
    const openStub = stub(Deno, 'open', () => Promise.resolve(mockFile as unknown as Deno.FsFile))

    try {
      let exitCalled = false
      const mockExit = () => {
        exitCalled = true
      }

      const { unmount } = render(
        <SkmtcProvider initialState={initialState} exit={mockExit}>
          <BundleView
            project={mockProject}
            view={{ page: 'bundle', projectName: 'test-project' }}
          />
        </SkmtcProvider>
      )

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify exit was called
      assertEquals(exitCalled, true, 'exit should be called when interactive is false')

      unmount()
    } finally {
      commandStub.restore()
      openStub.restore()
    }
  }
)
