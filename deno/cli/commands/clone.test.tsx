import React from 'react'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { printCloneResult, renderClone } from './clone.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { assertEquals, assertStringIncludes } from '@std/assert'
import type { CloneHeadlessResult } from '@/lib/clone-headless.ts'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test(
  'renderClone - interactive mode mounts the Ink App with the expected state',
  async () => {
    await withFakeTty(async () => {
      const manager = createMockManager()
      const mockSession = toMockSession()
      const toSessionSpy = spy(() => Promise.resolve(mockSession))
      manager.auth.toSession = toSessionSpy

      const skmtcRoot = createMockSkmtcRoot(manager)
      const testProjectName = 'test-project'
      const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)
      const AppSpy = (_props: AppProps): React.JSX.Element =>
        'AppSpy' as unknown as React.JSX.Element

      await renderClone({
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
                page: 'clone-generator',
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
  }
)

Deno.test('printCloneResult - text format reports cloned ids + verify hint', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printCloneResult(
      {
        projectName: 'my-api',
        cloned: ['@skmtc/gen-typescript', '@skmtc/gen-zod']
      },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs, [
    'Cloned 2 generator(s) into "my-api":',
    '  - @skmtc/gen-typescript',
    '  - @skmtc/gen-zod',
    '\nVerify with: ls .skmtc/my-api/'
  ])
})

Deno.test('printCloneResult - json format emits a parseable object with verifyWith', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printCloneResult(
      { projectName: 'my-api', cloned: ['@skmtc/gen-typescript'] },
      { format: 'json' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  const parsed: CloneHeadlessResult & { verifyWith: string } = JSON.parse(logs[0])
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(parsed.cloned, ['@skmtc/gen-typescript'])
  assertEquals(parsed.verifyWith, 'ls .skmtc/my-api/')
})

Deno.test(
  'renderClone - missing project name fails with a recipe error',
  async () => {
    // Missing project is fatal in both modes — there's no Ink view to
    // pick a project from. Same shape as the equivalent list/install
    // tests; only the usage/example differ.
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderClone({
        projectName: undefined,
        generators: ['@skmtc/gen-typescript']
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: <project>')
    assertStringIncludes(errors[0], '--generator')
  }
)

Deno.test(
  'renderClone - missing --generator flag fails in strict mode',
  async () => {
    // In strict mode the Ink MultiSelect picker doesn't run, so the
    // generator set must come via --generator. Closes friction #25.
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderClone({
        projectName: 'my-api',
        generators: undefined,
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: --generator')
    assertStringIncludes(errors[0], 'skmtc list <project>')
  }
)

Deno.test(
  'renderClone - empty --generator list also fails',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderClone({
        projectName: 'my-api',
        generators: [],
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertStringIncludes(errors[0], 'missing required argument: --generator')
  }
)
