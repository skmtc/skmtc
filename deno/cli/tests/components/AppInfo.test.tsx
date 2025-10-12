import React from 'react'
import { render } from 'ink-testing-library'
import { assertEquals, assertStringIncludes } from '@std/assert'
import { AppInfo } from '@/components/AppInfo.tsx'
import { SkmtcProvider } from '@/components/SkmtcContext.tsx'
import type { ViewState } from '@/components/SkmtcContext.tsx'
import denoJson from '../../deno.json' with { type: 'json' }
import { assertExists } from "@std/assert/exists";
import type { Session } from '@supabase/supabase-js'
import type { Generator } from '@/types/generator.generated.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { createTestSession } from "../mocks/session.mock.ts";

// Mock modules before importing components that use them
const mockGenerators: Generator[] = [
  {
    id: '1',
    name: 'test-generator',
    description: 'Test generator',
    dependencies: [],
    sourceUrl: 'https://example.com',
    registryUrl: 'https://jsr.io/@test/generator',
    readme: 'Test readme',
    scope: '@test',
    packageName: '@test/generator',
    createdAt: '2024-01-01'
  }
];

// Override toRelativeRootPath
(globalThis as any).__mockToRelativeRootPath = '/test/path'

// Test wrapper component
type TestWrapperProps = {
  children: React.ReactNode
  view?: ViewState
  session?: Session | null
  interactive?: boolean
}

const TestWrapper = ({ 
  children, 
  view = { page: 'home' },
  session = null,
  interactive = true
}: TestWrapperProps) => {
  const skmtcRoot = {
    manager: {
      auth: {
        supabase: {
          functions: {
            invoke: () => Promise.resolve({ data: mockGenerators, error: null })
          }
        }
      }
    }
  } as unknown as SkmtcRoot
  
  return (
    <SkmtcProvider
      view={view}
      skmtcRoot={skmtcRoot}
      session={session}
      interactive={interactive}
      exit={() => {}}
    >
      {children}
    </SkmtcProvider>
  )
}

// Helper to create test session


Deno.test('AppInfo - should not render when page is login', () => {
  const { lastFrame, unmount } = render(
    <TestWrapper view={{ page: 'login' }}>
      <AppInfo />
    </TestWrapper>
  )

  const output = lastFrame()

  assertExists(output)
  assertEquals(output, '')

  unmount()
})

// Deno.test('AppInfo - should not render when interactive is false', () => {
//   const { lastFrame, unmount } = render(
//     <TestWrapper interactive={false}>
//       <AppInfo />
//     </TestWrapper>
//   )

//   const output = lastFrame()

//   assertExists(output)
//   assertEquals(output, '')

//   unmount()
// })

Deno.test('AppInfo - renders with version and no user logged in', () => {
  const { lastFrame, unmount } = render(
    <TestWrapper>
      <AppInfo />
    </TestWrapper>
  )

  const output = lastFrame() 

  assertExists(output)
  assertStringIncludes(output, `＊ Skmtc CLI (v${denoJson.version})`)
  assertStringIncludes(output, 'You are not logged in')
  assertStringIncludes(output, 'directory: /test/path')

  unmount()
})

Deno.test('AppInfo - renders with logged in user', () => {
  const session = createTestSession('alice')
  
  const { lastFrame, unmount } = render(
    <TestWrapper session={session}>
      <AppInfo />
    </TestWrapper>
  )

  const output = lastFrame()

  assertExists(output)
  
  // Check for logged in user
  assertStringIncludes(output, 'Logged in as')
  assertStringIncludes(output, 'alice')
  
  unmount()
})

Deno.test('AppInfo - renders with project name', () => {
  const { lastFrame, unmount } = render(
    <TestWrapper view={{ page: 'project', projectName: 'my-project' }}>
      <AppInfo />
    </TestWrapper>
  )

  const output = lastFrame()

  assertExists(output)
  
  // Check for project name
  assertStringIncludes(output, 'project:')
  assertStringIncludes(output, 'my-project')
  
  unmount()
})

Deno.test('AppInfo - renders without project name when on home page', () => {
  const { lastFrame, unmount } = render(
    <TestWrapper view={{ page: 'home' }}>
      <AppInfo />
    </TestWrapper>
  )

  const output = lastFrame()

  assertExists(output)
  // Should have directory but not project
  assertStringIncludes(output, 'directory:')
  assertEquals(output.includes('project:'), false, 'Should not show project label on home')
  
  unmount()
})

// Clean up: restore original functions after tests
globalThis.addEventListener('unload', () => {
  delete (globalThis as any).__mockToRelativeRootPath
})