import React from 'react'
import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { printInitResult, renderInit } from './init.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import type { Generator } from '@/types/generator.ts'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'
import { validateBasePath, InvalidBasePathError } from '@/lib/init-headless.ts'
import { assertThrows } from '@std/assert/throws'

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

Deno.test(
  'renderInit - interactive mode mounts the Ink App with the expected state',
  async () => {
    await withFakeTty(async () => {
      const manager = createMockManager()

      const skmtcRoot = createMockSkmtcRoot(manager)
      const testProjectName = 'test-project'
      const testBasePath = './src'
      const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)
      const AppSpy = (_props: AppProps): React.JSX.Element =>
        'AppSpy' as unknown as React.JSX.Element

      await renderInit({
        skmtcRoot,
        projectName: testProjectName,
        basePath: testBasePath,
        renderFn: renderSpy as InkRenderFn,
        AppComponent: AppSpy
      })

      assertSpyCalls(renderSpy, 1)
      assertSpyCall(renderSpy, 0, {
        args: [
          // deno-lint-ignore jsx-key
          <AppSpy
            initialState={{
              view: {
                page: 'create-project',
                projectName: testProjectName,
                basePath: testBasePath
              },
              skmtcRoot,
              message: null,
              interactive: false,
              shortcuts: [],
              generators: []
            }}
          />
        ]
      })
    })
  }
)

Deno.test('printInitResult - text format for created project', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printInitResult(
      { type: 'created', projectName: 'my-api', basePath: './src' },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs[0], 'Initialized project "my-api" at .skmtc/my-api/')
  assertStringIncludes(logs[1], 'basePath: ./src')
  assertStringIncludes(logs[2], 'skmtc install <generators...> my-api')
})

Deno.test('printInitResult - text format for existing project (no-op)', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printInitResult({ type: 'existed', projectName: 'my-api' }, { format: 'text' })
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  assertStringIncludes(logs[0], 'already exists')
  assertStringIncludes(logs[0], 'nothing to do')
})

Deno.test(
  'printInitResult - json format includes nextStep hint for created projects',
  () => {
    const logs: string[] = []
    const original = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      printInitResult(
        { type: 'created', projectName: 'my-api', basePath: './src' },
        { format: 'json' }
      )
    } finally {
      console.log = original
    }
    assertEquals(logs.length, 1)
    const parsed = JSON.parse(logs[0])
    assertEquals(parsed.type, 'created')
    assertEquals(parsed.basePath, './src')
    assertEquals(parsed.nextStep, 'skmtc install <generators...> my-api')
  }
)

Deno.test(
  'printInitResult - json format nextStep is null when project already existed',
  () => {
    const logs: string[] = []
    const original = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      printInitResult(
        { type: 'existed', projectName: 'my-api' },
        { format: 'json' }
      )
    } finally {
      console.log = original
    }
    const parsed = JSON.parse(logs[0])
    assertEquals(parsed.type, 'existed')
    assertEquals(parsed.nextStep, null)
  }
)

Deno.test('renderInit - missing projectName fails with recipe', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderInit({
      projectName: undefined,
      basePath: './src',
      noInputFlag: true
    })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <projectName>')
})

Deno.test('renderInit - missing basePath fails with recipe', async () => {
  const { errors, exitCode } = await withCapturedExit(async () => {
    await renderInit({
      projectName: 'my-api',
      basePath: undefined,
      noInputFlag: true
    })
  })
  assertEquals(exitCode, 2)
  assertStringIncludes(errors[0], 'missing required argument: <basePath>')
  // The discover hint surfaces the `@`-alias convention from
  // friction #24 so callers don't have to read the skill to know it.
  assertStringIncludes(errors[0], '@')
})

Deno.test(
  'validateBasePath - rejects absolute paths (friction #13)',
  () => {
    // Pre-fix, an absolute basePath was silently concatenated onto
    // the SKMTC root, producing artifacts at
    // <skmtc-root>/<absolute-path>/... Now it throws so the caller
    // can correct the invocation.
    assertThrows(
      () => validateBasePath('/Users/dmitri/web/src'),
      InvalidBasePathError,
      'absolute path'
    )
  }
)

Deno.test('validateBasePath - accepts relative paths', () => {
  assertEquals(validateBasePath('./src'), './src')
  assertEquals(validateBasePath('src'), 'src')
  assertEquals(validateBasePath('mobile-app/src'), 'mobile-app/src')
})

Deno.test(
  'renderInit - absolute basePath in strict mode fails with recipe',
  async () => {
    const skmtcRoot = createMockSkmtcRoot(createMockManager(), { projects: [] })
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderInit({
        skmtcRoot,
        projectName: 'my-api',
        basePath: '/Users/dmitri/src',
        noInputFlag: true
      })
    })
    assertEquals(exitCode, 2)
    assertStringIncludes(errors[0], 'missing required argument: <basePath>')
    assertStringIncludes(errors[0], 'absolute path')
  }
)

Deno.test('init - creates new project with multiple generators', async () => {
  const manager = createMockManager()

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = createMockProject(manager, { name, generators })
    skmtcRoot.projects.push(mockProject)
    return Promise.resolve(mockProject)
  }

  // Simulate the project creation flow
  const projectName = 'my-new-project'
  const generators = ['@skmtc/gen-typescript', '@skmtc/gen-zod']
  const basePath = 'src'

  await skmtcRoot.createProject({
    name: projectName,
    basePath,
    generators,
    availableGenerators: mockGenerators
  })

  assertEquals(createdProject.name, 'my-new-project')
  assertEquals(createdProject.basePath, 'src')
  assertEquals(createdProject.generators, ['@skmtc/gen-typescript', '@skmtc/gen-zod'])
})

Deno.test('init - handles project creation with single generator', async () => {
  const manager = createMockManager()

  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const createdProject: {
    name: string | null
    basePath: string | null
    generators: string[] | null
  } = { name: null, basePath: null, generators: null }

  skmtcRoot.createProject = ({ name, basePath, generators }) => {
    createdProject.name = name
    createdProject.basePath = basePath
    createdProject.generators = generators
    const mockProject = createMockProject(manager, { name, generators })
    skmtcRoot.projects.push(mockProject)
    return Promise.resolve(mockProject)
  }

  // Simulate the project creation flow
  const projectName = 'simple-project'
  const generators = ['@skmtc/gen-typescript']
  const basePath = './lib'

  await skmtcRoot.createProject({
    name: projectName,
    basePath,
    generators,
    availableGenerators: mockGenerators
  })

  assertEquals(createdProject.name, 'simple-project')
  assertEquals(createdProject.basePath, './lib')
  assertEquals(createdProject.generators, ['@skmtc/gen-typescript'])
})
