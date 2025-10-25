import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals } from '@std/assert'
import { CreateProject } from '@/components/CreateProject.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '@/tests/mocks/session.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { assertSpyCall, stub } from '@std/testing/mock'
import type { Generator } from '@/types/generator.generated.ts'
import { type CreateProjectArgs, Project } from '../lib/project.ts'

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

// Mock setup helpers
const createMockSkmtcRoot = (): SkmtcRoot =>
  ({
    projects: [],
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
  }) as unknown as SkmtcRoot

const createInitialState = (overrides: Partial<SkmtcState> = {}): SkmtcState => ({
  view: { page: 'create-project' },
  skmtcRoot: createMockSkmtcRoot(),
  session: createTestSession(),
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
      <CreateProject {...props} />
    </SkmtcProvider>
  )
}

// Category 1: Component Rendering Tests

Deno.test('CreateProject - requests project name and loads generators', async () => {
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
│  Base path for generated files
│  src`
  )

  stdin.write('\r')

  await new Promise(resolve => setTimeout(resolve, 250))

  const creatingProject = lastFrame()

  assertEquals(
    creatingProject,
    `│  Project name
│  test-project
│
│  Select generators to install
│  @skmtc/gen-zod
│
│  Base path for generated files
│  src
│
│  ⠋ Creating project...`
  )

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
