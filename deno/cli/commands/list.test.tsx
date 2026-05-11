import React from 'react'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { printListResult, renderList } from './list.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { assertEquals, assertStringIncludes } from '@std/assert'
import type { ListHeadlessResult } from '@/lib/list-headless.ts'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test('renderList - interactive mode mounts the Ink App with the expected state', async () => {
  await withFakeTty(async () => {
    const manager = createMockManager()

    const mockSession = toMockSession()
    const toSessionSpy = spy(() => Promise.resolve(mockSession))
    manager.auth.toSession = toSessionSpy

    const skmtcRoot = createMockSkmtcRoot(manager)

    const testProjectName = 'test-project'
    const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)

    const AppSpy = (_props: AppProps): React.JSX.Element => 'AppSpy' as unknown as React.JSX.Element

    await renderList({
      skmtcRoot,
      projectName: testProjectName,
      renderFn: renderSpy as InkRenderFn,
      AppComponent: AppSpy
    })

    assertSpyCalls(toSessionSpy, 1)
    assertSpyCalls(renderSpy, 1)

    assertSpyCall(renderSpy, 0, {
      args: [
        // deno-lint-ignore jsx-key
        <AppSpy
          initialState={{
            view: {
              page: 'list-generators',
              projectName: testProjectName
            },
            skmtcRoot,
            session: mockSession,
            message: null,
            interactive: false,
            shortcuts: [],
            generators: []
          }}
        />
      ]
    })
  })
})

Deno.test('printListResult - text format mirrors the Ink view layout', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printListResult(
      {
        projectName: 'my-api',
        generators: ['@skmtc/gen-zod', '@skmtc/gen-tanstack-query']
      },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs, [
    'Generators in my-api:',
    '  - @skmtc/gen-zod',
    '  - @skmtc/gen-tanstack-query'
  ])
})

Deno.test('printListResult - text format reports an empty project distinctly', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printListResult({ projectName: 'empty', generators: [] }, { format: 'text' })
  } finally {
    console.log = original
  }
  assertEquals(logs, ['Generators in empty:', '  (none)'])
})

Deno.test('printListResult - json format emits a parseable single object', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printListResult(
      { projectName: 'my-api', generators: ['@skmtc/gen-zod'] },
      { format: 'json' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  const parsed: ListHeadlessResult = JSON.parse(logs[0])
  assertEquals(parsed, { projectName: 'my-api', generators: ['@skmtc/gen-zod'] })
})

Deno.test(
  'renderList - missing project name fails with a recipe error in strict mode',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderList({
        projectName: undefined,
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: <project>')
    assertStringIncludes(errors[0], 'skmtc list <project>')
    assertStringIncludes(errors[0], 'ls .skmtc/')
  }
)
