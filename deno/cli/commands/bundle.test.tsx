import React from 'react'
import { assertEquals, assertStringIncludes } from '@std/assert'
import { printBundleResult, renderBundle } from '@/commands/bundle.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import { toMockSession } from '@/tests/commands/session.test.ts'
import type { InkRenderFn } from '@/commands/types.ts'
import type { Instance } from 'ink'
import type { AppProps } from '@/components/App.tsx'
import { withCapturedExit, withFakeTty } from '@/tests/strict-mode-helpers.test.ts'

Deno.test(
  'renderBundle - interactive mode mounts the Ink App with the expected state',
  async () => {
    await withFakeTty(async () => {
      const manager = createMockManager()

      const mockSession = toMockSession()
      const toSessionSpy = spy(() => Promise.resolve(mockSession))
      manager.auth.toSession = toSessionSpy

      const mockProject = createMockProject(manager, { name: 'test-project' })
      const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

      const testProjectName = 'test-project'
      const renderSpy = spy((_element: React.ReactNode) => ({}) as Instance)
      const AppSpy = (_props: AppProps): React.JSX.Element =>
        'AppSpy' as unknown as React.JSX.Element

      await renderBundle({
        skmtcRoot,
        projectName: testProjectName,
        renderFn: renderSpy as InkRenderFn,
        AppComponent: AppSpy
      })

      assertSpyCalls(toSessionSpy, 1)
      assertSpyCalls(renderSpy, 1)

      const call = renderSpy.calls[0]
      const element = call.args[0] as React.ReactElement

      assertEquals(React.isValidElement(element), true)
      assertEquals(element.type, AppSpy)

      const props = element.props as {
        initialState: { view: { page: string; projectName: string } }
      }
      assertEquals(props.initialState.view.page, 'bundle')
      assertEquals(props.initialState.view.projectName, 'test-project')
    })
  }
)

Deno.test('printBundleResult - text format for bundled outcome', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printBundleResult(
      { kind: 'bundled', projectName: 'my-api', bundlePath: '/path/to/bundle.js' },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs, ['Bundled "my-api":', '  /path/to/bundle.js'])
})

Deno.test('printBundleResult - text format for remote-only noop', () => {
  // Friction #8: previously this case was a silent "no bundle.js
  // appeared" — operators couldn't tell it was an expected no-op.
  // The text form now spells it out.
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printBundleResult(
      {
        kind: 'noop',
        projectName: 'my-api',
        reason: 'remote-only',
        detail: 'Project has only remote (installed) generators; …'
      },
      { format: 'text' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 2)
  assertStringIncludes(logs[0], 'no-op')
  assertStringIncludes(logs[0], 'remote-only')
})

Deno.test('printBundleResult - json format emits the full discriminated union', () => {
  const logs: string[] = []
  const original = console.log
  console.log = (msg: string) => logs.push(msg)
  try {
    printBundleResult(
      {
        kind: 'noop',
        projectName: 'my-api',
        reason: 'remote-only',
        detail: 'Project has only remote (installed) generators'
      },
      { format: 'json' }
    )
  } finally {
    console.log = original
  }
  assertEquals(logs.length, 1)
  const parsed = JSON.parse(logs[0])
  assertEquals(parsed.kind, 'noop')
  assertEquals(parsed.reason, 'remote-only')
  assertEquals(parsed.projectName, 'my-api')
})

Deno.test(
  'renderBundle - missing project name fails with a recipe error',
  async () => {
    const { errors, exitCode } = await withCapturedExit(async () => {
      await renderBundle({
        projectName: undefined,
        noInputFlag: true
      })
    })

    assertEquals(exitCode, 2)
    assertEquals(errors.length, 1)
    assertStringIncludes(errors[0], 'missing required argument: <project>')
    assertStringIncludes(errors[0], 'skmtc bundle <project>')
  }
)
