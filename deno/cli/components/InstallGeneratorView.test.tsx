import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { InstallGeneratorView } from '@/components/InstallGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertSpyCall, stub } from '@std/testing/mock'
import type { Generator } from '@/types/generator.generated.ts'
import type { Project } from '@/lib/project.ts'
import type { Generator as GeneratorClass } from '@/lib/generator.ts'

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

// Mock generator instance
const mockGeneratorInstance = {
  projectName: 'test-project',
  scopeName: 'skmtc',
  packageName: 'gen-test',
  version: '1.0.0'
} as unknown as GeneratorClass

// Helper to create a fresh mock project for each test
const createMockProject = () => ({
  name: 'test-project',
  installGenerator: () => Promise.resolve(mockGeneratorInstance)
} as unknown as Project)

// Mock setup helpers
const createMockSkmtcRoot = (includeProjects = true, project?: Project): SkmtcRoot => {
  const actualProject = project || createMockProject()
  return {
    projects: includeProjects ? [actualProject] : [],
    findProject: (name: string) => {
      if (name === 'test-project') {
        return actualProject
      }
      throw new Error(`Project "${name}" not found`)
    },
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
  } as unknown as SkmtcRoot
}

const createInitialState = (overrides: Partial<SkmtcState> = {}, project?: Project): SkmtcState => ({
  view: { page: 'install-generator', projectName: undefined, generators: undefined },
  skmtcRoot: overrides.skmtcRoot || createMockSkmtcRoot(true, project),
  session: createTestSession(),
  interactive: true,
  message: null,
  shortcuts: [],
  generators: [],
  ...overrides
})

type RenderInstallGeneratorProps = {
  initialState: SkmtcState
  projectName: string | undefined
  generators: string[] | undefined
}

// Test helper to render component with context
const renderInstallGenerator = ({ initialState, projectName, generators }: RenderInstallGeneratorProps) => {
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <InstallGeneratorView
        view={{
          page: 'install-generator',
          projectName,
          generators
        }}
      />
    </SkmtcProvider>
  )
}

// Test 1: Interactive flow - Select project and generators
Deno.test('InstallGenerator - requests project selection and generators', async () => {
  const mockProject = createMockProject()
  const installStub = stub(mockProject, 'installGenerator', () => Promise.resolve(mockGeneratorInstance))

  const initialState = createInitialState({}, mockProject)

  const { lastFrame, unmount, stdin } = renderInstallGenerator({
    initialState,
    projectName: undefined,
    generators: undefined
  })

  // Should prompt for project selection
  const projectPrompt = lastFrame()

  assertEquals(
    projectPrompt,
    `│  Select project
│  ❯ test-project
│    Create new project`
  )

  // Select the project
  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  // Should now show generators selection
  const generatorsPrompt = lastFrame()

  assertEquals(
    generatorsPrompt,
    `│  Select project
│  test-project
│
│  Select generators to install
│  ❯ @skmtc/gen-typescript
│    @skmtc/gen-zod`
  )

  // Arrow down to select the Zod generator
  stdin.write('\u001B[B')

  await new Promise(resolve => setTimeout(resolve, 250))

  stdin.write(' ')

  await new Promise(resolve => setTimeout(resolve, 250))

  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  // Should show installing spinner (spinner character may vary)
  const installingFrame = lastFrame()

  // Check that it contains the key parts (spinner character varies)
  const hasCorrectStructure = installingFrame &&
    installingFrame.includes('Select project') &&
    installingFrame.includes('test-project') &&
    installingFrame.includes('Select generators to install') &&
    installingFrame.includes('@skmtc/gen-zod') &&
    installingFrame.includes('Installing generators...')

  assertEquals(hasCorrectStructure, true, `Expected installing frame to have correct structure, got:\n${installingFrame || 'undefined'}`)

  await new Promise(resolve => setTimeout(resolve, 250))

  // Verify installGenerator was called
  assertSpyCall(installStub, 0, {
    args: [{ moduleName: 'jsr:@skmtc/gen-zod' }]
  })

  // Wait for any pending timers to complete
  await new Promise(resolve => setTimeout(resolve, 100))

  unmount()
  installStub.restore()
})

// Test 2: Project provided, select generators
Deno.test('InstallGenerator - project provided, requests generators', { sanitizeResources: false, sanitizeOps: false }, async () => {
  const mockProject = createMockProject()
  const installStub = stub(mockProject, 'installGenerator', () => Promise.resolve(mockGeneratorInstance))

  const initialState = createInitialState({}, mockProject)

  const { lastFrame, unmount, stdin } = renderInstallGenerator({
    initialState,
    projectName: 'test-project',
    generators: undefined
  })

  // Wait for generators to load
  await new Promise(resolve => setTimeout(resolve, 250))

  // Should skip project selection and go to generators
  const generatorsPrompt = lastFrame()

  assertEquals(
    generatorsPrompt,
    `│  Select generators to install
│  ❯ @skmtc/gen-typescript
│    @skmtc/gen-zod`
  )

  // Select TypeScript generator
  stdin.write(' ')

  await new Promise(resolve => setTimeout(resolve, 250))

  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  // Should show installing spinner (spinner character may vary)
  const installingFrame = lastFrame()

  const hasCorrectStructure = installingFrame &&
    installingFrame.includes('Select generators to install') &&
    installingFrame.includes('@skmtc/gen-typescript') &&
    installingFrame.includes('Installing generators...')

  assertEquals(hasCorrectStructure, true, `Expected installing frame to have correct structure, got:\n${installingFrame || 'undefined'}`)

  await new Promise(resolve => setTimeout(resolve, 250))

  // Verify installGenerator was called with correct args
  assertSpyCall(installStub, 0, {
    args: [{ moduleName: 'jsr:@skmtc/gen-typescript' }]
  })

  // Wait for any pending timers to complete
  await new Promise(resolve => setTimeout(resolve, 100))

  unmount()
  installStub.restore()
})

// Test 3: All parameters provided (skip all prompts)
Deno.test('InstallGenerator - all parameters provided, installs immediately', { sanitizeResources: false, sanitizeOps: false }, async () => {
  const mockProject = createMockProject()
  const installStub = stub(mockProject, 'installGenerator', () => Promise.resolve(mockGeneratorInstance))

  const initialState = createInitialState({}, mockProject)

  const { lastFrame, unmount } = renderInstallGenerator({
    initialState,
    projectName: 'test-project',
    generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  })

  await new Promise(resolve => setTimeout(resolve, 200))

  // Should go directly to installing (spinner character may vary)
  const installingFrame = lastFrame()

  const hasSpinner = installingFrame && installingFrame.includes('Installing generators...')
  assertEquals(hasSpinner, true, `Expected installing spinner, got:\n${installingFrame || 'undefined'}`)

  // Wait for installation to complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Verify both generators were installed
  assertSpyCall(installStub, 0, {
    args: [{ moduleName: 'jsr:@skmtc/gen-typescript' }]
  })
  assertSpyCall(installStub, 1, {
    args: [{ moduleName: 'jsr:@skmtc/gen-zod' }]
  })

  unmount()
  installStub.restore()
})

// Test 4: Edge case - No projects available
Deno.test('InstallGenerator - no projects available shows message', { sanitizeResources: false, sanitizeOps: false }, async () => {
  const initialState = createInitialState({
    skmtcRoot: createMockSkmtcRoot(false)
  })

  const { lastFrame, unmount } = renderInstallGenerator({
    initialState,
    projectName: undefined,
    generators: undefined
  })

  await new Promise(resolve => setTimeout(resolve, 200))

  // Should show "No projects found" message
  const noProjectsFrame = lastFrame()

  assertEquals(
    noProjectsFrame,
    `│  No projects found`
  )

  // Wait for any pending timers to complete
  await new Promise(resolve => setTimeout(resolve, 800))

  unmount()
})