import React from 'react'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { printInstallResult, renderInstall } from './install.tsx'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { toMockSession } from '../tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { assertEquals, assertStringIncludes } from '@std/assert'
import type { InstallHeadlessResult } from '@/lib/install-headless.ts'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test(
  'renderInstall - interactive mode mounts the Ink App with the expected state',
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

      await renderInstall({
        skmtcRoot,
        projectName: testProjectName,
        generators: undefined,
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
                page: 'install-generator',
                projectName: testProjectName,
                generators: undefined
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

Deno.test('printInstallResult - text format reports installed ids + verify hint', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printInstallResult(
      {
        projectName: 'my-api',
        installed: ['@skmtc/gen-zod', '@skmtc/gen-tanstack-query']
      },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs, [
    'Installed 2 generator(s) in "my-api":',
    '  - @skmtc/gen-zod',
    '  - @skmtc/gen-tanstack-query',
    '\nVerify with: cat .skmtc/my-api/deno.json'
  ])
})

Deno.test('printInstallResult - json format emits a parseable object with verifyWith hint', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printInstallResult(
      {
        projectName: 'my-api',
        installed: ['@skmtc/gen-zod']
      },
      { format: 'json' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  const parsed: InstallHeadlessResult & { verifyWith: string } = JSON.parse(logs[0])
  assertEquals(parsed.projectName, 'my-api')
  assertEquals(parsed.installed, ['@skmtc/gen-zod'])
  assertEquals(parsed.verifyWith, 'cat .skmtc/my-api/deno.json')
})

Deno.test(
  'renderInstall - missing project name fails with a recipe error in strict mode',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderInstall({
        projectName: undefined,
        generators: ['@skmtc/gen-zod'],
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: <project>')
    assertStringIncludes(errors[0], 'skmtc install <generators...> <project>')
    assertStringIncludes(errors[0], 'ls .skmtc/')
  }
)

Deno.test(
  'renderInstall - missing generators fails with a recipe error in strict mode',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderInstall({
        projectName: 'my-api',
        generators: undefined,
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: <generators...>')
  }
)

Deno.test(
  'renderInstall - empty generators array also fails (not just undefined)',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderInstall({
        projectName: 'my-api',
        generators: [],
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertStringIncludes(errors[0], 'missing required argument: <generators...>')
  }
)
