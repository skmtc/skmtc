import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { CreateProjectView } from './CreateProjectView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertSpyCall, stub } from '@std/testing/mock'
import { stubRegistryGenerators } from '@/tests/mocks/registry.mock.ts'
import type { Generator } from '@/types/generator.ts'
import { type CreateProjectArgs, Project } from '../lib/project.ts'

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

// Mock setup helpers
const createMockSkmtcRoot = (): SkmtcRoot =>
  ({
    projects: [],
    manager: {}
  }) as unknown as SkmtcRoot

const createInitialState = (overrides: Partial<SkmtcState> = {}): SkmtcState => ({
  view: { page: 'create-project' },
  skmtcRoot: createMockSkmtcRoot(),
  interactive: true,
  message: null,
  shortcuts: [],
  generators: [],
  ...overrides
})

type RenderCreateProjectProps = {
  initialState: SkmtcState
  projectName: string | undefined
  generators: string[] | undefined
  basePath: string | undefined
}

// Test helper to render component with context
const renderCreateProject = ({ initialState, ...props }: RenderCreateProjectProps) => {
  const mockExit = () => {}

  return render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <CreateProjectView {...props} />
    </SkmtcProvider>
  )
}

// Category 1: Component Rendering Tests

Deno.test('CreateProject - requests project name and loads generators', async () => {
  using fetchStub = stubRegistryGenerators(mockGenerators)

  const projectCreateStub = stub(Project, 'create', ({ name }: CreateProjectArgs) =>
    Promise.resolve({ name } as unknown as Project)
  )

  const initialState = createInitialState()

  const { lastFrame, unmount, stdin } = renderCreateProject({
    initialState,
    projectName: undefined,
    generators: undefined,
    basePath: undefined
  })

  const projectNamePrompt = lastFrame()

  assertEquals(
    projectNamePrompt,
    `│  Project name
│`
  )

  stdin.write('test-project')

  await new Promise(resolve => setTimeout(resolve, 250))

  const projectName = lastFrame()

  assertEquals(
    projectName,
    `│  Project name
│  test-project`
  )

  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  const generatorsPrompt = lastFrame()

  assertEquals(
    generatorsPrompt,
    `│  Project name
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

  const basePathPrompt = lastFrame()

  assertEquals(
    basePathPrompt,
    `│  Project name
│  test-project
│
│  Select generators to install
│  @skmtc/gen-zod
│
│  Output directory for generated files
│  src`
  )

  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  assertSpyCall(projectCreateStub, 0, {
    args: [
      {
        name: 'test-project',
        basePath: 'src',
        generators: ['@skmtc/gen-zod'],
        skmtcRoot: initialState.skmtcRoot,
        availableGenerators: mockGenerators
      }
    ]
  })

  // Component should render without errors
  unmount()
})
