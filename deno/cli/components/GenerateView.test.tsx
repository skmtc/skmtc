import '@/tests/setup.ts'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { GenerateView } from '@/components/GenerateView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import type { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { stub } from '@std/testing/mock'
import { GenerateArtifacts } from '../lib/generate-artifacts.ts'

// Minimal OpenAPI schema for testing
const minimalOpenAPISchema = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {}
})

// Mock generators data to prevent API calls
const mockGenerators = [
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
  }
]

// Mock GenerateResponse to prevent API calls
const mockGenerateResponse = {
  artifacts: {
    'test-file.ts': 'export const test = "hello"'
  },
  manifest: {
    deploymentId: 'test-deployment',
    traceId: 'test-trace',
    spanId: 'test-span',
    files: {
      'test-file.ts': {
        lines: 1,
        characters: 28,
        destinationPath: 'src/test-file.ts'
      }
    },
    previews: {},
    results: {},
    startAt: Date.now() - 1000,
    endAt: Date.now()
  }
}

// Helper to create a mock project without schema for interactive testing
const createMockProjectWithoutSchema = (
  manager: ReturnType<typeof createMockManager>,
  name: string
): Project => {
  const mockProject = createMockProject(manager, { name })
  // Override schemaFile to have no path
  return {
    ...mockProject,
    schemaFile: {
      contents: null,
      schemaSource: undefined,
      refresh: async () => {}
    }
  } as unknown as Project
}

// Mock SkmtcRoot with proper Supabase mocking
const createMockSkmtcRoot = (project: Project): SkmtcRoot =>
  ({
    projects: [project],
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
      },
      cleanup: () => Promise.resolve()
    }
  }) as unknown as SkmtcRoot

// Helper to create initial state
const createInitialState = (project: Project): SkmtcState => {
  const skmtcRoot = createMockSkmtcRoot(project)

  return {
    view: {
      page: 'generate',
      project,
      schemaSourceString: undefined,
      watchMode: undefined,
      basePath: undefined
    },
    skmtcRoot,
    session: createTestSession(),
    interactive: true,
    message: null,
    shortcuts: [],
    generators: mockGenerators
  }
}

type RenderGenerateViewProps = {
  initialState: SkmtcState
  project: Project
  schemaSourceString: string | undefined
  watchMode: boolean | undefined
  basePath: string | undefined
}

// Test helper to render component with context
const renderGenerateView = ({
  initialState,
  project,
  schemaSourceString,
  watchMode,
  basePath
}: RenderGenerateViewProps) => {
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <GenerateView
        project={project}
        schemaSourceString={schemaSourceString}
        watchMode={watchMode}
        basePath={basePath}
      />
    </SkmtcProvider>
  )
}

// Test 1: Interactive flow - Prompt for schema location and watch mode, select watch mode
Deno.test(
  'GenerateView - requests schema location and enables watch mode',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProjectWithoutSchema(manager, 'test-project')

    const initialState = createInitialState(mockProject)

    // Stub file read to return minimal OpenAPI schema
    const readTextFileStub = stub(Deno, 'readTextFile', () => Promise.resolve(minimalOpenAPISchema))

    // Stub filesystem operations to prevent actual file/directory creation
    const mkdirSyncStub = stub(Deno, 'mkdirSync', () => {})
    const writeTextFileStub = stub(Deno, 'writeTextFile', () => Promise.resolve())

    // Stub Deno.Command to prevent process spawning
    const commandStub = stub(Deno, 'Command', () => ({
      spawn: () => ({
        stdout: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        stderr: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        kill: () => {}
      })
    }))

    // Stub Deno.open to prevent log file operations
    const openStub = stub(Deno, 'open', () =>
      Promise.resolve({
        write: () => Promise.resolve(0),
        close: () => {}
      } as unknown as Deno.FsFile)
    )

    // Stub Deno.connect to make ports appear available
    const connectStub = stub(Deno, 'connect', () => {
      throw new Error('Connection refused')
    })

    // Stub generateArtifacts to prevent API calls
    const generateStub = stub(GenerateArtifacts, 'generateWithSandboxApi', () =>
      Promise.resolve(mockGenerateResponse)
    )

    try {
      const { lastFrame, unmount, stdin } = renderGenerateView({
        initialState,
        project: mockProject,
        schemaSourceString: undefined,
        watchMode: undefined,
        basePath: 'src'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should prompt for schema location
      const schemaPrompt = lastFrame()

      assertEquals(
        schemaPrompt,
        `│  Input OpenAPI schema path or URL
│`
      )

      // Enter schema path
      stdin.write('schema.json')

      await new Promise(resolve => setTimeout(resolve, 25))

      const schemaPath = lastFrame()

      assertEquals(
        schemaPath,
        `│  Input OpenAPI schema path or URL
│  schema.json`
      )

      await new Promise(resolve => setTimeout(resolve, 25))

      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should prompt for watch mode
      const watchPrompt = lastFrame()

      assertEquals(
        watchPrompt,
        `│  Input OpenAPI schema path or URL
│  schema.json
│
│  Watch for changes?
│  ❯ Yes
│    No`
      )

      // Select Yes (default) - just hit enter
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should show watching spinner (not generating, since we selected Yes for watch mode)
      const watchingFrame = lastFrame()

      const hasWatchingSpinner =
        watchingFrame &&
        watchingFrame.includes('Input OpenAPI schema path or URL') &&
        watchingFrame.includes('schema.json') &&
        watchingFrame.includes('Watch for changes?') &&
        watchingFrame.includes('Yes') &&
        watchingFrame.includes('Watching...')

      assertEquals(
        hasWatchingSpinner,
        true,
        `Expected watching frame, got:\n${watchingFrame || 'undefined'}`
      )

      unmount()
    } finally {
      readTextFileStub.restore()
      mkdirSyncStub.restore()
      writeTextFileStub.restore()
      commandStub.restore()
      openStub.restore()
      connectStub.restore()
      generateStub.restore()
    }
  }
)

// Test 2: Schema provided, prompt for watch mode only
Deno.test(
  'GenerateView - schema provided, requests watch mode',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    const initialState = createInitialState(mockProject)

    // Stub filesystem operations to prevent actual file/directory creation
    const mkdirSyncStub = stub(Deno, 'mkdirSync', () => {})
    const writeTextFileStub = stub(Deno, 'writeTextFile', () => Promise.resolve())

    // Stub Deno.Command to prevent process spawning
    const commandStub = stub(Deno, 'Command', () => ({
      spawn: () => ({
        stdout: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        stderr: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        kill: () => {}
      })
    }))

    // Stub Deno.open to prevent log file operations
    const openStub = stub(Deno, 'open', () =>
      Promise.resolve({
        write: () => Promise.resolve(0),
        close: () => {}
      } as unknown as Deno.FsFile)
    )

    // Stub Deno.connect to make ports appear available
    const connectStub = stub(Deno, 'connect', () => {
      throw new Error('Connection refused')
    })

    // Stub fetch to make server ready check succeed immediately
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )

    try {
      const { lastFrame, unmount, stdin } = renderGenerateView({
        initialState,
        project: mockProject,
        schemaSourceString: 'schema.json',
        watchMode: undefined,
        basePath: 'src'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should skip schema prompt and go to watch mode
      const watchPrompt = lastFrame()

      assertEquals(
        watchPrompt,
        `│  Watch for changes?
│  ❯ Yes
│    No`
      )

      // Select Yes
      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 25))

      // Should show watching spinner (different from generating)
      const watchingFrame = lastFrame()

      const hasWatchingSpinner = watchingFrame && watchingFrame.includes('Watching...')

      assertEquals(
        hasWatchingSpinner,
        true,
        `Expected watching frame, got:\n${watchingFrame || 'undefined'}`
      )

      unmount()
    } finally {
      mkdirSyncStub.restore()
      writeTextFileStub.restore()
      commandStub.restore()
      openStub.restore()
      connectStub.restore()
      fetchStub.restore()
    }
  }
)

// Test 3: All parameters provided (skip all prompts)
Deno.test(
  'GenerateView - all parameters provided, generates immediately',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    const initialState = createInitialState(mockProject)

    // Stub file read to return minimal OpenAPI schema
    const readTextFileStub = stub(Deno, 'readTextFile', () => Promise.resolve(minimalOpenAPISchema))

    // Stub filesystem operations to prevent actual file/directory creation
    const mkdirSyncStub = stub(Deno, 'mkdirSync', () => {})
    const writeTextFileStub = stub(Deno, 'writeTextFile', () => Promise.resolve())

    // Stub Deno.Command to prevent process spawning
    const commandStub = stub(Deno, 'Command', () => ({
      spawn: () => ({
        stdout: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        stderr: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        kill: () => {}
      })
    }))

    // Stub Deno.open to prevent log file operations
    const openStub = stub(Deno, 'open', () =>
      Promise.resolve({
        write: () => Promise.resolve(0),
        close: () => {}
      } as unknown as Deno.FsFile)
    )

    // Stub Deno.connect to make ports appear available
    const connectStub = stub(Deno, 'connect', () => {
      throw new Error('Connection refused')
    })

    // Stub fetch to make server ready check succeed immediately
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(new Response('{}', { status: 200 }))
    )

    // Stub generateArtifacts to prevent API calls
    const generateStub = stub(GenerateArtifacts, 'generateWithSandboxApi', () =>
      Promise.resolve(mockGenerateResponse)
    )

    try {
      const { lastFrame, unmount } = renderGenerateView({
        initialState,
        project: mockProject,
        schemaSourceString: 'schema.json',
        watchMode: false,
        basePath: 'src'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should go directly to generating
      const generatingFrame = lastFrame()

      const hasGeneratingSpinner = generatingFrame && generatingFrame.includes('Generating...')

      assertEquals(
        hasGeneratingSpinner,
        true,
        `Expected generating spinner, got:\n${generatingFrame || 'undefined'}`
      )

      unmount()
    } finally {
      readTextFileStub.restore()
      mkdirSyncStub.restore()
      writeTextFileStub.restore()
      commandStub.restore()
      openStub.restore()
      connectStub.restore()
      fetchStub.restore()
      generateStub.restore()
    }
  }
)

// Test 4: Remote schema (HTTP URL) - no watch mode prompt
Deno.test(
  'GenerateView - remote schema skips watch mode prompt',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProject(manager, { name: 'test-project' })

    const initialState = createInitialState(mockProject)

    // Stub fetch to return minimal OpenAPI schema
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(
        new Response(minimalOpenAPISchema, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )

    // Stub filesystem operations to prevent actual file/directory creation
    const mkdirSyncStub = stub(Deno, 'mkdirSync', () => {})
    const writeTextFileStub = stub(Deno, 'writeTextFile', () => Promise.resolve())

    // Stub Deno.Command to prevent process spawning
    const commandStub = stub(Deno, 'Command', () => ({
      spawn: () => ({
        stdout: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        stderr: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        kill: () => {}
      })
    }))

    // Stub Deno.open to prevent log file operations
    const openStub = stub(Deno, 'open', () =>
      Promise.resolve({
        write: () => Promise.resolve(0),
        close: () => {}
      } as unknown as Deno.FsFile)
    )

    // Stub Deno.connect to make ports appear available
    const connectStub = stub(Deno, 'connect', () => {
      throw new Error('Connection refused')
    })

    // Stub generateArtifacts to prevent API calls
    const generateStub = stub(GenerateArtifacts, 'generateWithSandboxApi', () =>
      Promise.resolve(mockGenerateResponse)
    )

    try {
      const { lastFrame, unmount } = renderGenerateView({
        initialState,
        project: mockProject,
        schemaSourceString: 'https://api.example.com/openapi.json',
        watchMode: undefined,
        basePath: 'src'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should skip watch mode prompt and go directly to generating
      const generatingFrame = lastFrame()

      const hasGeneratingSpinner = generatingFrame && generatingFrame.includes('Generating...')

      assertEquals(
        hasGeneratingSpinner,
        true,
        `Expected generating spinner for remote schema, got:\n${generatingFrame || 'undefined'}`
      )

      unmount()
    } finally {
      fetchStub.restore()
      mkdirSyncStub.restore()
      writeTextFileStub.restore()
      commandStub.restore()
      openStub.restore()
      connectStub.restore()
      generateStub.restore()
    }
  }
)

// Test 5: Interactive with remote URL input
Deno.test(
  'GenerateView - user enters remote URL and selects watch mode',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    const manager = createMockManager()
    const mockProject = createMockProjectWithoutSchema(manager, 'test-project')

    const initialState = createInitialState(mockProject)

    // Stub fetch to return minimal OpenAPI schema
    const fetchStub = stub(globalThis, 'fetch', () =>
      Promise.resolve(
        new Response(minimalOpenAPISchema, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )

    // Stub filesystem operations to prevent actual file/directory creation
    const mkdirSyncStub = stub(Deno, 'mkdirSync', () => {})
    const writeTextFileStub = stub(Deno, 'writeTextFile', () => Promise.resolve())

    // Stub Deno.Command to prevent process spawning
    const commandStub = stub(Deno, 'Command', () => ({
      spawn: () => ({
        stdout: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        stderr: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: () => {}
          })
        },
        kill: () => {}
      })
    }))

    // Stub Deno.open to prevent log file operations
    const openStub = stub(Deno, 'open', () =>
      Promise.resolve({
        write: () => Promise.resolve(0),
        close: () => {}
      } as unknown as Deno.FsFile)
    )

    // Stub Deno.connect to make ports appear available
    const connectStub = stub(Deno, 'connect', () => {
      throw new Error('Connection refused')
    })

    // Stub generateArtifacts to prevent API calls
    const generateStub = stub(GenerateArtifacts, 'generateWithSandboxApi', () =>
      Promise.resolve(mockGenerateResponse)
    )

    try {
      const { lastFrame, unmount, stdin } = renderGenerateView({
        initialState,
        project: mockProject,
        schemaSourceString: undefined,
        watchMode: undefined,
        basePath: 'src'
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      // Should prompt for schema location
      const schemaPrompt = lastFrame()

      assertEquals(
        schemaPrompt,
        `│  Input OpenAPI schema path or URL
│`
      )

      // Enter remote URL
      stdin.write('https://api.example.com/openapi.json')

      await new Promise(resolve => setTimeout(resolve, 25))

      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should show watch prompt even for remote URL
      const watchPrompt = lastFrame()

      assertEquals(
        watchPrompt,
        `│  Input OpenAPI schema path or URL
│  https://api.example.com/openapi.json
│
│  Watch for changes?
│  ❯ Yes
│    No`
      )

      // Select No for remote URL (can't watch remote)
      stdin.write('\u001B[B') // Arrow down to "No"

      await new Promise(resolve => setTimeout(resolve, 25))

      stdin.write('\r')

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should now show generating
      const generatingFrame = lastFrame()

      assertEquals(
        generatingFrame,
        `│  Input OpenAPI schema path or URL
│  https://api.example.com/openapi.json
│
│  Watch for changes?
│  No
│
│  ⠋ Generating...`
      )

      unmount()
    } finally {
      fetchStub.restore()
      mkdirSyncStub.restore()
      writeTextFileStub.restore()
      commandStub.restore()
      openStub.restore()
      connectStub.restore()
      generateStub.restore()
    }
  }
)
