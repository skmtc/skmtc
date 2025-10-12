import { render } from 'ink-testing-library'
import { assertExists, assertEquals } from '@std/assert'
import { InstallGeneratorView } from '@/components/InstallGeneratorView.tsx'
import { SkmtcProvider, type SkmtcState } from '@/components/SkmtcContext.tsx'
import { createTestSession } from '../mocks/session.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import type { Generator } from '@/types/generator.generated.ts'
import { _joinExpects } from 'valibot'
import { assertStringIncludes } from '@std/assert/string-includes'

const mockGenerators: Generator[] = [
  {
    id: '1',
    name: 'test-generator-1',
    description: 'Test generator 1',
    dependencies: [],
    sourceUrl: 'https://example.com',
    registryUrl: 'https://jsr.io/@test/generator1',
    readme: 'Test readme 1',
    scope: 'test',
    packageName: 'generator1',
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    name: 'test-generator-2',
    description: 'Test generator 2',
    dependencies: [],
    sourceUrl: 'https://example.com',
    registryUrl: 'https://jsr.io/@test/generator2',
    readme: 'Test readme 2',
    scope: 'test',
    packageName: 'generator2',
    createdAt: '2024-01-01'
  }
]

Deno.test('InstallGeneratorView - moves down and selects generator', async () => {
  const mockSession = createTestSession()
  const mockExit = () => {}
  const mockManager = createMockManager()
  const mockProject = createMockProject(mockManager)

  // Set up mock response for generators API
  // @ts-ignore: access mock for testing
  const supabaseMock = mockManager._supabaseMock
  supabaseMock.mockResponse('/generators', {
    data: mockGenerators,
    error: null
  })

  const mockSkmtcRoot = {
    projects: [],
    manager: mockManager
  } as unknown as SkmtcRoot

  const initialState: SkmtcState = {
    view: { page: 'install-generator', projectName: 'test-project' },
    skmtcRoot: mockSkmtcRoot,
    session: mockSession,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  const { lastFrame, unmount, stdin } = render(
    <SkmtcProvider initialState={initialState} exit={mockExit}>
      <InstallGeneratorView
        project={mockProject}
        view={{ page: 'install-generator', projectName: 'test-project' }}
      />
    </SkmtcProvider>
  )

  const output = lastFrame()

  assertExists(output)
  assertStringIncludes(output, 'Fetching generators...')

  await new Promise(resolve => setTimeout(resolve, 0))

  assertEquals(
    lastFrame(),
    `Select generators to install
❯ @test/generator1
  @test/generator2`
  )

  await new Promise(resolve => setTimeout(resolve, 20))

  stdin.write('\u001B[B')
  stdin.write(' ')

  await new Promise(resolve => setTimeout(resolve, 50))

  stdin.write('\r')

  assertEquals(
    lastFrame(),
    `Select generators to install
  @test/generator1
❯ @test/generator2 ✔`
  )

  unmount()
})
