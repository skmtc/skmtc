import { render } from 'ink-testing-library'
import { assertEquals, assertStringIncludes } from '@std/assert'
import { InstallGeneratorView } from '@/components/InstallGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertSpyCall, stub } from '@std/testing/mock'
import { stubRegistryGenerators } from '@/tests/mocks/registry.mock.ts'
import type { Generator } from '@/types/generator.ts'
import type { Project } from '@/lib/project.ts'
import type { Generator as GeneratorClass } from '@/lib/generator.ts'
import { pointer, tick } from '@/test/pointer.ts'
import { waitFor } from '@/test/wait-for.ts'

// Mock generators data
const mockGenerators: Generator[] = [
  {
    scope: 'skmtc',
    packageName: 'gen-typescript',
    dependencies: []
  },
  {
    scope: 'skmtc',
    packageName: 'gen-zod',
    dependencies: []
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
const createMockProject = () =>
  ({
    name: 'test-project',
    installGenerator: () => Promise.resolve(mockGeneratorInstance)
  }) as unknown as Project

// Mock setup helpers
const createMockSkmtcRoot = (
  includeProjects = true,
  project?: Project,
  unloadedNames: string[] = []
): SkmtcRoot => {
  const actualProject = project || createMockProject()
  return {
    projects: includeProjects ? [actualProject] : [],
    unloadedProjects: unloadedNames.map(name => ({ name, error: new Error('missing schema') })),
    findProject: (name: string) => {
      if (name === 'test-project') {
        return actualProject
      }
      throw new Error(`Project "${name}" not found`)
    },
    manager: {}
  } as unknown as SkmtcRoot
}

const createInitialState = (
  overrides: Partial<SkmtcState> = {},
  project?: Project
): SkmtcState => ({
  view: { page: 'install-generator', projectName: undefined, generators: undefined },
  skmtcRoot: overrides.skmtcRoot || createMockSkmtcRoot(true, project),
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
const renderInstallGenerator = ({
  initialState,
  projectName,
  generators
}: RenderInstallGeneratorProps) => {
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
  using fetchStub = stubRegistryGenerators(mockGenerators)

  const mockProject = createMockProject()
  const installStub = stub(mockProject, 'installGenerator', () =>
    Promise.resolve(mockGeneratorInstance)
  )

  const initialState = createInitialState({}, mockProject)

  const { lastFrame, unmount, stdin } = renderInstallGenerator({
    initialState,
    projectName: undefined,
    generators: undefined
  })

  // Should prompt for project selection
  await waitFor(() =>
    assertEquals(
      lastFrame(),
      `│  Select project
│  ${pointer} test-project
│    Create new project`
    )
  )

  // Select the project
  stdin.write('\r')

  // Should now show generators selection
  await waitFor(() =>
    assertEquals(
      lastFrame(),
      `│  Select project
│  test-project
│
│  Select generators to install
│  ${pointer} @skmtc/gen-typescript
│    @skmtc/gen-zod`
    )
  )

  // Arrow down to select the Zod generator
  stdin.write('\u001B[B')

  await waitFor(() =>
    assertEquals(
      lastFrame(),
      `│  Select project
│  test-project
│
│  Select generators to install
│    @skmtc/gen-typescript
│  ${pointer} @skmtc/gen-zod`
    )
  )

  stdin.write(' ')

  await waitFor(() =>
    assertEquals(
      lastFrame(),
      `│  Select project
│  test-project
│
│  Select generators to install
│    @skmtc/gen-typescript
│  ${pointer} @skmtc/gen-zod ${tick}`
    )
  )

  stdin.write('\r')

  // Should show installing spinner, then call installGenerator
  await waitFor(() => {
    const installingFrame = lastFrame() ?? ''
    assertStringIncludes(installingFrame, 'Select project')
    assertStringIncludes(installingFrame, 'test-project')
    assertStringIncludes(installingFrame, 'Select generators to install')
    assertStringIncludes(installingFrame, '@skmtc/gen-zod')
    assertStringIncludes(installingFrame, 'Installing generators...')
  })

  await waitFor(() =>
    assertSpyCall(installStub, 0, {
      args: [{ moduleName: 'jsr:@skmtc/gen-zod' }]
    })
  )

  unmount()
  installStub.restore()
})

// Test 2: Project provided, select generators
Deno.test(
  'InstallGenerator - project provided, requests generators',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const mockProject = createMockProject()
    const installStub = stub(mockProject, 'installGenerator', () =>
      Promise.resolve(mockGeneratorInstance)
    )

    const initialState = createInitialState({}, mockProject)

    const { lastFrame, unmount, stdin } = renderInstallGenerator({
      initialState,
      projectName: 'test-project',
      generators: undefined
    })

    // Should skip project selection and go to generators once they load
    await waitFor(() =>
      assertEquals(
        lastFrame(),
        `│  Select generators to install
│  ${pointer} @skmtc/gen-typescript
│    @skmtc/gen-zod`
      )
    )

    // Select TypeScript generator
    stdin.write(' ')

    await waitFor(() =>
      assertEquals(
        lastFrame(),
        `│  Select generators to install
│  ${pointer} @skmtc/gen-typescript ${tick}
│    @skmtc/gen-zod`
      )
    )

    stdin.write('\r')

    // Should show installing spinner, then call installGenerator
    await waitFor(() => {
      const installingFrame = lastFrame() ?? ''
      assertStringIncludes(installingFrame, 'Select generators to install')
      assertStringIncludes(installingFrame, '@skmtc/gen-typescript')
      assertStringIncludes(installingFrame, 'Installing generators...')
    })

    await waitFor(() =>
      assertSpyCall(installStub, 0, {
        args: [{ moduleName: 'jsr:@skmtc/gen-typescript' }]
      })
    )

    unmount()
    installStub.restore()
  }
)

// Test 3: All parameters provided (skip all prompts)
Deno.test(
  'InstallGenerator - all parameters provided, installs immediately',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const mockProject = createMockProject()
    const installStub = stub(mockProject, 'installGenerator', () =>
      Promise.resolve(mockGeneratorInstance)
    )

    const initialState = createInitialState({}, mockProject)

    const { lastFrame, unmount } = renderInstallGenerator({
      initialState,
      projectName: 'test-project',
      generators: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
    })

    // Should go directly to installing
    await waitFor(() => assertStringIncludes(lastFrame() ?? '', 'Installing generators...'))

    // Verify both generators were installed
    await waitFor(() => {
      assertSpyCall(installStub, 0, {
        args: [{ moduleName: 'jsr:@skmtc/gen-typescript' }]
      })
      assertSpyCall(installStub, 1, {
        args: [{ moduleName: 'jsr:@skmtc/gen-zod' }]
      })
    })

    unmount()
    installStub.restore()
  }
)

// Test 4: Edge case - No projects available
Deno.test(
  'InstallGenerator - no projects available shows message',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const initialState = createInitialState({
      skmtcRoot: createMockSkmtcRoot(false)
    })

    const { lastFrame, unmount } = renderInstallGenerator({
      initialState,
      projectName: undefined,
      generators: undefined
    })

    // Should show "No projects found" message
    await waitFor(() => assertEquals(lastFrame(), `│  No projects found`))

    unmount()
  }
)

Deno.test(
  'InstallGenerator - no project loaded names the ones that did not load',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const initialState = createInitialState({
      skmtcRoot: createMockSkmtcRoot(false, undefined, ['broken'])
    })

    const { lastFrame, unmount } = renderInstallGenerator({
      initialState,
      projectName: undefined,
      generators: undefined
    })

    // Not "No projects found": the folder is there, and its warning is above.
    await waitFor(() =>
      assertEquals(
        lastFrame(),
        `│  No project loaded. Did not load: broken (see the warnings above).`
      )
    )

    unmount()
  }
)

// Test 5: A project name that does not exist still prompts, and a
// `jsr:`-prefixed generator is not prefixed twice.
Deno.test(
  'InstallGenerator - unknown project name prompts for a project',
  { sanitizeResources: false, sanitizeOps: false },
  async () => {
    using fetchStub = stubRegistryGenerators(mockGenerators)

    const mockProject = createMockProject()
    const installStub = stub(mockProject, 'installGenerator', () =>
      Promise.resolve(mockGeneratorInstance)
    )

    const initialState = createInitialState({}, mockProject)

    const { lastFrame, unmount, stdin } = renderInstallGenerator({
      initialState,
      projectName: 'missing-project',
      generators: ['jsr:@skmtc/gen-zod']
    })

    await waitFor(() =>
      assertEquals(
        lastFrame(),
        `│  Select project
│  ${pointer} test-project
│    Create new project`
      )
    )

    stdin.write('\r')

    await waitFor(() =>
      assertSpyCall(installStub, 0, {
        args: [{ moduleName: 'jsr:@skmtc/gen-zod' }]
      })
    )

    unmount()
    installStub.restore()
  }
)
